import axios from 'axios';
import jwt from 'jsonwebtoken';
import { DefaultAzureCredential, DeviceCodeCredential } from '@azure/identity';
import { promises as fs } from 'fs';
import path from 'path';


type Primitive = string | number | boolean;

type TokenMode = 'device-code' | 'default-credential';

interface TokenCacheRecord {
  token: string;
  expiresOnTimestamp: number;
  scope: string;
  mode: TokenMode;
  tenantId: string;
  clientId: string;
  cachedAt: string;
}

interface LiveFireContext {
  baseUrl: string;
  authHeader: { Authorization: string };
  tenantId: string;
  clientId: string;
}

interface PollOptions {
  attempts: number;
  intervalMs: number;
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

function isEnvTrue(name: string): boolean {
  const raw = optionalEnv(name);
  return raw === 'true' || raw === '1' || raw?.toLowerCase() === 'yes';
}

function envNumber(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number. Received: ${raw}`);
  }
  return parsed;
}

const currentDir = __dirname;

function tokenCacheFilePath(): string {
  const configured = optionalEnv('AXIOM_LIVE_TOKEN_CACHE_FILE');
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(currentDir, '.livefire-token-cache.json');
}

function tokenCacheSkewSeconds(): number {
  return envNumber('AXIOM_LIVE_TOKEN_CACHE_SKEW_SECONDS', 120);
}

function isTokenCacheDisabled(): boolean {
  return isEnvTrue('AXIOM_LIVE_DISABLE_TOKEN_CACHE');
}

function parseJwtExpiry(token: string): number | undefined {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') {
    return undefined;
  }
  const exp = (decoded as Record<string, unknown>)['exp'];
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) {
    return undefined;
  }
  return exp;
}

function isCacheMatch(
  record: TokenCacheRecord,
  mode: TokenMode,
  scope: string,
  tenantId: string,
  clientId: string,
): boolean {
  return (
    record.mode === mode &&
    record.scope === scope &&
    record.tenantId === tenantId &&
    record.clientId === clientId
  );
}

async function readTokenCache(
  mode: TokenMode,
  scope: string,
  tenantId: string,
  clientId: string,
): Promise<string | undefined> {
  if (isTokenCacheDisabled()) {
    return undefined;
  }

  const cachePath = tokenCacheFilePath();
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as TokenCacheRecord;

    if (!isCacheMatch(parsed, mode, scope, tenantId, clientId)) {
      return undefined;
    }

    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    const skew = tokenCacheSkewSeconds();
    if (parsed.expiresOnTimestamp <= nowEpochSeconds + skew) {
      return undefined;
    }

    return parsed.token;
  } catch {
    return undefined;
  }
}

async function writeTokenCache(
  mode: TokenMode,
  scope: string,
  tenantId: string,
  clientId: string,
  token: string,
): Promise<void> {
  if (isTokenCacheDisabled()) {
    return;
  }

  const exp = parseJwtExpiry(token);
  if (!exp) {
    return;
  }

  const record: TokenCacheRecord = {
    token,
    expiresOnTimestamp: exp,
    scope,
    mode,
    tenantId,
    clientId,
    cachedAt: new Date().toISOString(),
  };

  const cachePath = tokenCacheFilePath();
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(record, null, 2), 'utf8');
}

function resolveTokenScope(): string {
  const explicitScope = optionalEnv('AXIOM_LIVE_TOKEN_SCOPE');
  if (explicitScope) {
    return explicitScope;
  }

  const audienceClientId =
    optionalEnv('AXIOM_LIVE_AUDIENCE_CLIENT_ID') ??
    optionalEnv('AZURE_API_CLIENT_ID');

  if (!audienceClientId) {
    throw new Error(
      'Missing token scope. Set AXIOM_LIVE_TOKEN_SCOPE, or AXIOM_LIVE_AUDIENCE_CLIENT_ID (or AZURE_API_CLIENT_ID).',
    );
  }

  return `api://${audienceClientId}/.default`;
}

function buildTestToken(tenantId: string, clientId: string): string {
  const secret = optionalEnv('AXIOM_LIVE_TEST_JWT_SECRET');
  if (!secret) {
    throw new Error('AXIOM_LIVE_BEARER_TOKEN is required, or set AXIOM_LIVE_TEST_JWT_SECRET to mint a test token.');
  }

  const subject = optionalEnv('AXIOM_LIVE_TEST_SUBJECT') ?? 'axiom-live-fire-user';
  const name = optionalEnv('AXIOM_LIVE_TEST_NAME') ?? 'Axiom Live Fire';
  const email = optionalEnv('AXIOM_LIVE_TEST_EMAIL') ?? 'axiom-live-fire@test.local';

  return jwt.sign(
    {
      sub: subject,
      name,
      email,
      role: 'admin',
      tenantId,
      clientId,
      iss: 'appraisal-management-test',
      aud: 'appraisal-management-api',
      isTestToken: true,
    },
    secret,
    { expiresIn: '1h' },
  );
}

async function resolveBearerToken(tenantId: string, clientId: string): Promise<string> {
  const explicitBearer = optionalEnv('AXIOM_LIVE_BEARER_TOKEN');
  if (explicitBearer) {
    return explicitBearer;
  }

  const useDeviceCode = isEnvTrue('AXIOM_LIVE_USE_DEVICE_CODE');
  const useDefaultCredential = isEnvTrue('AXIOM_LIVE_USE_DEFAULT_CREDENTIAL');
  if (useDeviceCode && useDefaultCredential) {
    throw new Error(
      'Set only one auth mode: AXIOM_LIVE_USE_DEVICE_CODE=true OR AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true (not both).',
    );
  }

  if (useDeviceCode) {
    const scope = resolveTokenScope();
    const deviceCodeClientId = requiredEnv('AXIOM_LIVE_DEVICE_CODE_CLIENT_ID');
    const deviceCodeTenantId =
      optionalEnv('AXIOM_LIVE_DEVICE_CODE_TENANT_ID') ??
      optionalEnv('AZURE_TENANT_ID');

    if (!deviceCodeTenantId) {
      throw new Error(
        'AXIOM_LIVE_USE_DEVICE_CODE=true requires AXIOM_LIVE_DEVICE_CODE_TENANT_ID or AZURE_TENANT_ID.',
      );
    }

    const cached = await readTokenCache('device-code', scope, tenantId, clientId);
    if (cached) {
      return cached;
    }

    const credential = new DeviceCodeCredential({
      clientId: deviceCodeClientId,
      tenantId: deviceCodeTenantId,
      userPromptCallback: (info) => {
        console.log(info.message);
      },
    });

    const token = await credential.getToken(scope);
    if (!token?.token) {
      throw new Error(`DeviceCodeCredential returned no token for scope: ${scope}`);
    }

    await writeTokenCache('device-code', scope, tenantId, clientId, token.token);

    return token.token;
  }

  if (useDefaultCredential) {
    const scope = resolveTokenScope();

    const cached = await readTokenCache('default-credential', scope, tenantId, clientId);
    if (cached) {
      return cached;
    }

    const credential = new DefaultAzureCredential();
    const token = await credential.getToken(scope);
    if (!token?.token) {
      throw new Error(`DefaultAzureCredential returned no token for scope: ${scope}`);
    }

    await writeTokenCache('default-credential', scope, tenantId, clientId, token.token);

    return token.token;
  }

  return buildTestToken(tenantId, clientId);
}

export async function loadLiveFireContext(): Promise<LiveFireContext> {
  const baseUrl = requiredEnv('AXIOM_LIVE_BASE_URL').replace(/\/$/, '');
  const tenantId = requiredEnv('AXIOM_LIVE_TENANT_ID');
  const clientId = requiredEnv('AXIOM_LIVE_CLIENT_ID');

  const bearer = await resolveBearerToken(tenantId, clientId);

  return {
    baseUrl,
    tenantId,
    clientId,
    authHeader: { Authorization: `Bearer ${bearer}` },
  };
}

export function loadPollOptions(): PollOptions {
  return {
    attempts: envNumber('AXIOM_LIVE_POLL_ATTEMPTS', 20),
    intervalMs: envNumber('AXIOM_LIVE_POLL_INTERVAL_MS', 3000),
  };
}

export function logSection(title: string): void {
  const width = 72;
  const suffix = '─'.repeat(Math.max(0, width - title.length));
  console.log(`\n${title} ${suffix}`);
}

export function logConfig(context: LiveFireContext, extras?: Record<string, Primitive | undefined>): void {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('Axiom Live-Fire Test');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`baseUrl   : ${context.baseUrl}`);
  console.log(`tenantId  : ${context.tenantId}`);
  console.log(`clientId  : ${context.clientId}`);
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined) {
        console.log(`${key.padEnd(10, ' ')}: ${String(value)}`);
      }
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (isRecord(value)) {
    return Object.values(value).some((item) => hasMeaningfulContent(item));
  }

  return false;
}

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; data: T }> {
  const res = await axios.get<T>(url, { headers, validateStatus: () => true });
  return { status: res.status, data: res.data };
}

export async function postJson<TResponse>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: TResponse }> {
  const res = await axios.post<TResponse>(url, body, {
    headers: { ...headers, ...(extraHeaders ?? {}) },
    validateStatus: () => true,
  });
  return { status: res.status, data: res.data };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function assertStatus(
  actual: number,
  expected: number[],
  operation: string,
  payload?: unknown,
): void {
  if (!expected.includes(actual)) {
    throw new Error(
      `${operation} returned unexpected status ${actual}. Expected one of [${expected.join(', ')}]. Response: ${JSON.stringify(payload)}`,
    );
  }
}
