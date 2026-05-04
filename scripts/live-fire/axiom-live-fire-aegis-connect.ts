#!/usr/bin/env tsx

import { execSync } from 'child_process';

const DEFAULT_BASE_URL = 'https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io';
const DEFAULT_RESOURCE = 'api://3bc96929-593c-4f35-8997-e341a7e09a69';
const DEFAULT_ENDPOINT = '/api/health';
const DEFAULT_ROLE_ENDPOINT = '/api/virtual-actors';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function envBool(name: string, fallback = true): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'y';
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token is not a valid JWT (expected 3 dot-separated parts).');
  }

  const payload = parts[1];
  if (!payload) {
    throw new Error('Token payload segment is missing.');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

function acquireEntraToken(resource: string): string {
  const azPath = process.env['AXIOM_AEGIS_AZ_PATH']?.trim() || 'az';
  try {
    const cmd = `"${azPath}" account get-access-token --resource "${resource}" --query accessToken -o tsv`;
    const raw = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true });

    const token = raw.trim();
    if (!token) {
      throw new Error('Azure CLI returned an empty token value.');
    }
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to acquire Entra token via Azure CLI for resource '${resource}'. ` +
      `Run 'az login' with a user assigned to axiom-api app roles. ` +
      `If Azure CLI is not on PATH, set AXIOM_AEGIS_AZ_PATH to az executable path. Root error: ${message}`,
    );
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

async function main(): Promise<void> {
  const baseUrl = normalizeBaseUrl(optionalEnv('AXIOM_AEGIS_BASE_URL', DEFAULT_BASE_URL));
  const resource = optionalEnv('AXIOM_AEGIS_RESOURCE', DEFAULT_RESOURCE);
  const endpoint = normalizeEndpoint(optionalEnv('AXIOM_AEGIS_ENDPOINT', DEFAULT_ENDPOINT));
  const checkRoleEndpoint = envBool('AXIOM_AEGIS_CHECK_ROLE_ENDPOINT', true);
  const roleEndpoint = normalizeEndpoint(optionalEnv('AXIOM_AEGIS_ROLE_ENDPOINT', DEFAULT_ROLE_ENDPOINT));
  const clientId = requiredEnv('AXIOM_AEGIS_CLIENT_ID');
  const subClientId = process.env['AXIOM_AEGIS_SUB_CLIENT_ID']?.trim();

  console.log('Axiom Aegis Connection Probe');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`baseUrl     : ${baseUrl}`);
  console.log(`resource    : ${resource}`);
  console.log(`endpoint    : ${endpoint}`);
  if (checkRoleEndpoint) {
    console.log(`roleEndpoint: ${roleEndpoint}`);
  }
  console.log(`clientId    : ${clientId}`);
  if (subClientId) {
    console.log(`subClientId : ${subClientId}`);
  }

  console.log('\nStep 1/2 — Acquire Entra token via Azure CLI');
  const token = acquireEntraToken(resource);
  const claims = decodeJwtPayload(token);
  console.log('✓ Token acquired');
  console.log(`  aud: ${String(claims['aud'] ?? 'n/a')}`);
  console.log(`  iss: ${String(claims['iss'] ?? 'n/a')}`);
  console.log(`  exp: ${String(claims['exp'] ?? 'n/a')}`);

  console.log('\nStep 2/2 — Call Axiom API');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Client-Id': clientId,
  };
  if (subClientId) {
    headers['X-Sub-Client-Id'] = subClientId;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Axiom request failed: HTTP ${response.status} ${response.statusText}. ` +
      `Response: ${text.slice(0, 400)}`,
    );
  }

  console.log(`✓ Connected — HTTP ${response.status}`);
  console.log(`Response: ${text.slice(0, 400)}`);

  if (!checkRoleEndpoint) {
    return;
  }

  console.log('\nStep 3/3 — Verify role-gated endpoint');
  const roleResponse = await fetch(`${baseUrl}${roleEndpoint}`, {
    method: 'GET',
    headers,
  });
  const roleText = await roleResponse.text();

  if (!roleResponse.ok) {
    throw new Error(
      `Role endpoint check failed: HTTP ${roleResponse.status} ${roleResponse.statusText}. ` +
      `Response: ${roleText.slice(0, 400)}`,
    );
  }

  console.log(`✓ Role endpoint OK — HTTP ${roleResponse.status}`);
  console.log(`Role response: ${roleText.slice(0, 400)}`);
}

main().catch((error) => {
  console.error('\n✗ Axiom Aegis connection failed');
  console.error((error as Error).message);
  process.exit(1);
});
