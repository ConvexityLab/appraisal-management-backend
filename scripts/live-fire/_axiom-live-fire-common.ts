import axios from 'axios';
import jwt from 'jsonwebtoken';

type Primitive = string | number | boolean;

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

function envNumber(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number. Received: ${raw}`);
  }
  return parsed;
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

export function loadLiveFireContext(): LiveFireContext {
  const baseUrl = requiredEnv('AXIOM_LIVE_BASE_URL').replace(/\/$/, '');
  const tenantId = requiredEnv('AXIOM_LIVE_TENANT_ID');
  const clientId = requiredEnv('AXIOM_LIVE_CLIENT_ID');

  const bearer = optionalEnv('AXIOM_LIVE_BEARER_TOKEN') ?? buildTestToken(tenantId, clientId);

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
