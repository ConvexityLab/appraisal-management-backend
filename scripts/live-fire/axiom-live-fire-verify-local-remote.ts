#!/usr/bin/env tsx

import { spawn } from 'child_process';

const FLOW_TO_SCRIPT: Record<string, string> = {
  'property-intake': 'axiom:livefire:property-intake',
  'document-flow': 'axiom:livefire:document-flow',
  'analyze-webhook': 'axiom:livefire:analyze-webhook',
  preflight: 'axiom:livefire:preflight',
};

type Target = 'local' | 'remote';

interface RunResult {
  target: Target;
  command: string;
  exitCode: number;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function resolveIncludeLocal(): boolean {
  const argIncludeLocal = process.argv.some((arg) => arg === '--include-local');
  return argIncludeLocal || isTruthy(process.env['AXIOM_VERIFY_INCLUDE_LOCAL']);
}

function resolveFlow(): string {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env['AXIOM_VERIFY_FLOW']?.trim();
  const flow = fromArg || fromEnv;

  if (!flow) {
    throw new Error(
      'Missing flow. Pass one as argv[2] or AXIOM_VERIFY_FLOW: property-intake | document-flow | analyze-webhook | preflight.',
    );
  }

  if (!FLOW_TO_SCRIPT[flow]) {
    throw new Error(
      `Unsupported flow: ${flow}. Supported: ${Object.keys(FLOW_TO_SCRIPT).join(', ')}`,
    );
  }

  return flow;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function mapTargetOverrides(target: Target): Record<string, string> {
  const prefix = target === 'local' ? 'AXIOM_LOCAL_' : 'AXIOM_REMOTE_';
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (!key.startsWith(prefix)) continue;

    const suffix = key.slice(prefix.length);
    if (!suffix) continue;

    result[`AXIOM_LIVE_${suffix}`] = value;
  }

  return result;
}

function buildTargetEnv(target: Target): NodeJS.ProcessEnv {
  const localBaseUrl = optionalEnv('AXIOM_VERIFY_LOCAL_BASE_URL') ?? 'http://localhost:3011';
  const remoteBaseUrl = requiredEnv('AXIOM_VERIFY_REMOTE_BASE_URL');

  const baseUrl = target === 'local' ? localBaseUrl : remoteBaseUrl;
  const overrides = mapTargetOverrides(target);

  return {
    ...process.env,
    AXIOM_LIVE_BASE_URL: baseUrl,
    ...overrides,
  };
}

async function runFlowForTarget(flowScript: string, target: Target): Promise<RunResult> {
  const command = `pnpm ${flowScript}`;
  const env = buildTargetEnv(target);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(`Running ${target.toUpperCase()} live-fire: ${command}`);
  console.log(`AXIOM_LIVE_BASE_URL=${env['AXIOM_LIVE_BASE_URL']}`);
  console.log('════════════════════════════════════════════════════════════════════════');

  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn('pnpm', [flowScript], {
      stdio: 'inherit',
      shell: true,
      env,
    });

    child.on('error', reject);
    child.on('close', (exitCode) => resolve(exitCode ?? 1));
  });

  return {
    target,
    command,
    exitCode: code,
  };
}

function printSummary(results: RunResult[]): void {
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('Live-Fire Verification Summary');
  console.log('════════════════════════════════════════════════════════════════════════');
  for (const result of results) {
    const status = result.exitCode === 0 ? 'PASS' : 'FAIL';
    console.log(`${result.target.padEnd(6, ' ')} | ${status} | exit=${result.exitCode} | ${result.command}`);
  }
}

async function main(): Promise<void> {
  const flow = resolveFlow();
  const flowScript = FLOW_TO_SCRIPT[flow];
  const includeLocal = resolveIncludeLocal();

  const results: RunResult[] = [];

  if (includeLocal) {
    const local = await runFlowForTarget(flowScript, 'local');
    results.push(local);
  }

  const remote = await runFlowForTarget(flowScript, 'remote');
  results.push(remote);

  printSummary(results);

  if (results.some((item) => item.exitCode !== 0)) {
    process.exit(1);
  }

  if (includeLocal) {
    console.log('\n✅ Local and remote live-fire runs passed.');
  } else {
    console.log('\n✅ Remote live-fire run passed.');
  }
}

main().catch((error) => {
  console.error(`\n❌ Local/remote verifier failed: ${(error as Error).message}`);
  process.exit(1);
});
