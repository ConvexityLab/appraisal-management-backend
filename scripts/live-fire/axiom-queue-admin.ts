#!/usr/bin/env tsx
/**
 * axiom-queue-admin.ts
 *
 * Reusable CLI for inspecting and controlling the Axiom BullMQ pipeline queue
 * via the remote Axiom admin API.
 *
 * Commands (first positional arg):
 *   stats                    Overall queue counts (waiting / active / delayed / failed / completed)
 *   active       [limit]     List currently active (executing) jobs
 *   stuck        [maxAgeMs]  List active jobs older than maxAgeMs (default 300 000 ms = 5 min)
 *   fail-stuck   [maxAgeMs]  Force-move stuck jobs to failed state
 *   clean-failed [minAgeMs]  Remove old failed jobs older than minAgeMs (default 1 ms = all)
 *   flush                    fail-stuck + clean-failed + final stats in one shot
 *
 * Required env vars (set via .env or environment):
 *   AXIOM_API_BASE_URL              e.g. https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io
 *   AXIOM_ADMIN_AUDIENCE_CLIENT_ID  Azure AD app registration client ID for Axiom (token audience)
 *                                   Defaults to AXIOM_ADMIN_AUDIENCE if unset.
 *
 * Auth:
 *   Uses DefaultAzureCredential — works with `az login`, managed identity, or
 *   workload identity. No API keys.
 *
 * Usage:
 *   npx tsx --env-file .env scripts/live-fire/axiom-queue-admin.ts stats
 *   npx tsx --env-file .env scripts/live-fire/axiom-queue-admin.ts flush
 *   npx tsx --env-file .env scripts/live-fire/axiom-queue-admin.ts stuck 60000
 *   npx tsx --env-file .env scripts/live-fire/axiom-queue-admin.ts clean-failed
 */

import axios, { type AxiosInstance } from 'axios';
import { DefaultAzureCredential } from '@azure/identity';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused?: number;
}

interface QueueJob {
  id: string;
  timestamp?: number;
  data?: Record<string, unknown>;
  attemptsMade?: number;
  [key: string]: unknown;
}

interface ActiveJobsResponse {
  jobs: QueueJob[];
  count: number;
  limit: number;
  offset: number;
}

interface StuckJobsResponse {
  jobs: QueueJob[];
  count: number;
  maxAgeMs: number;
}

interface FailStuckResponse {
  action: string;
  failed: number;
  maxAgeMs: number;
}

interface CleanResponse {
  action: string;
  removed: number;
  age: number;
  type: string;
}

// ─── Env helpers ─────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v?.trim() || undefined;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAxiomAdminToken(): Promise<string> {
  const clientId =
    optionalEnv('AXIOM_ADMIN_AUDIENCE_CLIENT_ID') ??
    optionalEnv('AXIOM_ADMIN_AUDIENCE');

  if (!clientId) {
    throw new Error(
      'Missing AXIOM_ADMIN_AUDIENCE_CLIENT_ID (Azure AD app registration client ID for Axiom). ' +
      'Set it in your .env file.',
    );
  }

  const scope = `api://${clientId}/.default`;
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken(scope);

  if (!tokenResponse?.token) {
    throw new Error(`DefaultAzureCredential returned no token for scope: ${scope}`);
  }

  return tokenResponse.token;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

function buildClient(baseUrl: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl}/api/admin/queue`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true, // handle all statuses explicitly
    timeout: 30_000, // 30 s — prevents hanging on cold-start or dead connection
  });
}

function assertOk(status: number, operation: string, data: unknown): void {
  if (status < 200 || status >= 300) {
    throw new Error(
      `${operation} failed with HTTP ${status}: ${JSON.stringify(data)}`,
    );
  }
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function cmdStats(client: AxiosInstance): Promise<void> {
  console.log('📡 GET /api/admin/queue/stats ...');
  const res = await client.get<QueueStats>('/stats');
  assertOk(res.status, 'GET /stats', res.data);
  const s = res.data;
  console.log('\n📊 Queue Stats');
  console.log('─────────────────────────────────────');
  console.log(`  waiting  : ${s.waiting}`);
  console.log(`  active   : ${s.active}`);
  console.log(`  delayed  : ${s.delayed}`);
  console.log(`  failed   : ${s.failed}`);
  console.log(`  completed: ${s.completed}`);
  if (s.paused !== undefined) console.log(`  paused   : ${s.paused}`);
}

async function cmdActive(client: AxiosInstance, limit = 50): Promise<void> {
  const res = await client.get<ActiveJobsResponse>(`/active?limit=${limit}`);
  assertOk(res.status, 'GET /active', res.data);
  const { jobs, count } = res.data;
  console.log(`\n⚡ Active jobs: ${count}`);
  for (const job of jobs) {
    const ageMs = job.timestamp ? Date.now() - job.timestamp : undefined;
    const ageSec = ageMs !== undefined ? Math.round(ageMs / 1000) : '?';
    console.log(`  ${job.id}  age=${ageSec}s  attempts=${job.attemptsMade ?? 0}`);
  }
}

async function cmdStuck(client: AxiosInstance, maxAgeMs = 300_000): Promise<void> {
  const res = await client.get<StuckJobsResponse>(`/stuck?maxAge=${maxAgeMs}`);
  assertOk(res.status, 'GET /stuck', res.data);
  const { jobs, count } = res.data;
  console.log(`\n⚠️  Stuck jobs (>${maxAgeMs}ms): ${count}`);
  for (const job of jobs) {
    const ageMs = job.timestamp ? Date.now() - job.timestamp : undefined;
    const ageSec = ageMs !== undefined ? Math.round(ageMs / 1000) : '?';
    console.log(`  ${job.id}  age=${ageSec}s  attempts=${job.attemptsMade ?? 0}`);
  }
}

async function cmdFailStuck(client: AxiosInstance, maxAgeMs = 300_000): Promise<number> {
  const res = await client.post<FailStuckResponse>(`/stuck/fail?maxAge=${maxAgeMs}`);
  assertOk(res.status, 'POST /stuck/fail', res.data);
  const { failed } = res.data;
  console.log(`✅ Force-failed ${failed} stuck job(s) (age >${maxAgeMs}ms)`);
  return failed;
}

async function cmdCleanFailed(client: AxiosInstance, minAgeMs = 1): Promise<number> {
  const res = await client.post<CleanResponse>('/clean', { age: minAgeMs, type: 'failed' });
  assertOk(res.status, 'POST /clean (failed)', res.data);
  const { removed } = res.data;
  console.log(`✅ Removed ${removed} old failed job(s) (age >${minAgeMs}ms)`);
  return removed;
}

async function cmdFlush(client: AxiosInstance): Promise<void> {
  console.log('\n🚿 Flushing queue: fail stuck + clean failed + stats');
  console.log('─────────────────────────────────────────────────────');

  // 1. Show current state
  const before = await client.get<QueueStats>('/stats');
  assertOk(before.status, 'GET /stats (before)', before.data);
  const b = before.data;
  console.log(`Before: waiting=${b.waiting} active=${b.active} failed=${b.failed} completed=${b.completed}`);

  // 2. Force-fail any stuck active jobs (>60s)
  await cmdFailStuck(client, 60_000);

  // 3. Remove all failed job records (age=1ms = everything older than 1ms)
  await cmdCleanFailed(client, 1);

  // 4. Final state
  await cmdStats(client);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [command, arg1] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    console.log(`
axiom-queue-admin — Axiom BullMQ queue management CLI

Usage:
  npx tsx --env-file .env scripts/live-fire/axiom-queue-admin.ts <command> [args]

Commands:
  stats                    Show queue counts
  active       [limit]     List active jobs (default limit: 50)
  stuck        [maxAgeMs]  List stuck jobs (default: 300000ms)
  fail-stuck   [maxAgeMs]  Force-fail stuck jobs (default: 300000ms)
  clean-failed [minAgeMs]  Remove failed job records (default: 1ms = all)
  flush                    fail-stuck(60s) + clean-failed + stats

Required env:
  AXIOM_API_BASE_URL              Remote Axiom API base URL
  AXIOM_ADMIN_AUDIENCE_CLIENT_ID  Azure AD client ID for token scope
`);
    process.exit(0);
  }

  const baseUrl = requiredEnv('AXIOM_API_BASE_URL');
  console.log(`🔑 Acquiring Azure AD token for Axiom admin API...`);
  const token = await getAxiomAdminToken();
  console.log(`✅ Token acquired`);

  const client = buildClient(baseUrl, token);

  switch (command) {
    case 'stats':
      await cmdStats(client);
      break;
    case 'active':
      await cmdActive(client, arg1 ? parseInt(arg1, 10) : 50);
      break;
    case 'stuck':
      await cmdStuck(client, arg1 ? parseInt(arg1, 10) : 300_000);
      break;
    case 'fail-stuck':
      await cmdFailStuck(client, arg1 ? parseInt(arg1, 10) : 300_000);
      break;
    case 'clean-failed':
      await cmdCleanFailed(client, arg1 ? parseInt(arg1, 10) : 1);
      break;
    case 'flush':
      await cmdFlush(client);
      break;
    default:
      console.error(`Unknown command: ${command}. Run with --help for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌', (err as Error).message);
  process.exit(1);
});
