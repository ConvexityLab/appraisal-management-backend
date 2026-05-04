#!/usr/bin/env tsx

import { spawn } from 'child_process';
import {
  getJson,
  loadLiveFireContext,
  logConfig,
  logSection,
} from './_axiom-live-fire-common.js';

interface AxiomHealthStatus {
  missingEnvVars?: string[];
}

interface HealthServicesResponse {
  success?: boolean;
  data?: {
    services?: {
      ai?: {
        axiom?: AxiomHealthStatus;
      };
    };
  };
}

const REQUIRED_AXIOM_ENVS = [
  'AXIOM_API_BASE_URL',
  'API_BASE_URL',
  'AXIOM_WEBHOOK_SECRET',
  'STORAGE_CONTAINER_DOCUMENTS',
] as const;

const AXIOM_AUTH_MODE_ENVS = [
  'AXIOM_API_KEY',
  'AXIOM_USE_DEFAULT_CREDENTIAL',
] as const;

const FLOW_COMMANDS = [
  'axiom:livefire:preflight',
  'axiom:livefire:property-intake',
  'axiom:livefire:document-flow',
  'axiom:livefire:analyze-webhook',
] as const;

async function runPnpmScript(scriptName: string): Promise<void> {
  const cmd = `pnpm ${scriptName}`;
  console.log(`\n→ ${cmd}`);

  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn('pnpm', [scriptName], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('error', reject);
    child.on('close', (exitCode) => resolve(exitCode ?? 1));
  });

  if (code !== 0) {
    throw new Error(`${cmd} failed with exit code ${code}`);
  }
}

async function validateDeployedAxiomEnv(baseUrl: string, authHeader: { Authorization: string }): Promise<void> {
  logSection('Step 1: Validate deployed backend Axiom env requirements');

  const healthApiKey = process.env['AXIOM_LIVE_HEALTH_API_KEY']?.trim();
  const healthHeaders = {
    ...authHeader,
    ...(healthApiKey ? { 'X-Health-Api-Key': healthApiKey } : {}),
  };

  const health = await getJson<HealthServicesResponse>(`${baseUrl}/api/health/services`, healthHeaders);
  if (health.status !== 200) {
    throw new Error(
      `GET /api/health/services returned ${health.status}. ` +
      'Set AXIOM_LIVE_HEALTH_API_KEY if health endpoints are key-protected.',
    );
  }

  const missing = health.data?.data?.services?.ai?.axiom?.missingEnvVars ?? [];
  const blockingMissing = REQUIRED_AXIOM_ENVS.filter((envName) => missing.includes(envName));
  const hasAuthModeConfigured = AXIOM_AUTH_MODE_ENVS.some((envName) => !missing.includes(envName));

  if (blockingMissing.length > 0 || !hasAuthModeConfigured) {
    const blocking: string[] = [...blockingMissing];
    if (!hasAuthModeConfigured) {
      blocking.push('AXIOM_API_KEY (or AXIOM_USE_DEFAULT_CREDENTIAL=true)');
    }

    throw new Error(
      `Deployed backend is missing required Axiom env vars: ${blocking.join(', ')}. ` +
      'Fix deployment configuration, then re-run the remote suite.',
    );
  }

  console.log(
    `✓ Deployed backend reports required Axiom env vars present: ` +
      `${[...REQUIRED_AXIOM_ENVS, 'AXIOM_API_KEY|AXIOM_USE_DEFAULT_CREDENTIAL'].join(', ')}`,
  );
}

function validateRequiredLiveFireInputs(): void {
  logSection('Step 2: Validate live-fire input env prerequisites');

  const required = [
    'AXIOM_LIVE_ORDER_ID',
    'AXIOM_LIVE_DOCUMENT_ID',
    'AXIOM_LIVE_DOCUMENT_URL',
    'AXIOM_LIVE_REVISED_DOCUMENT_URL',
    'AXIOM_LIVE_PROPERTY_ADDRESS',
    'AXIOM_LIVE_PROPERTY_CITY',
    'AXIOM_LIVE_PROPERTY_STATE',
    'AXIOM_LIVE_PROPERTY_ZIP',
  ] as const;

  const missing = required.filter((name) => {
    const value = process.env[name];
    return !value || !value.trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required live-fire input env vars: ${missing.join(', ')}. ` +
      'Run `pnpm axiom:livefire:preflight` first to discover order/document IDs and export values, then set property fields.',
    );
  }

  console.log('✓ Live-fire input env prerequisites are present');
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  logConfig(context);

  await validateDeployedAxiomEnv(context.baseUrl, context.authHeader);
  validateRequiredLiveFireInputs();

  logSection('Step 3: Execute full remote-first live-fire suite');
  for (const scriptName of FLOW_COMMANDS) {
    await runPnpmScript(scriptName);
  }

  console.log('\n✅ Full remote-first Axiom live-fire suite passed.');
}

main().catch((error) => {
  console.error(`\n❌ Axiom remote suite failed: ${(error as Error).message}`);
  process.exit(1);
});
