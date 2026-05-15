#!/usr/bin/env tsx

import jwt from 'jsonwebtoken';
import { pathToFileURL } from 'url';

import {
  assertStatus,
  getJson,
  isRecord,
  loadLiveFireContext,
  logConfig,
  logSection,
} from './_axiom-live-fire-common.js';
import { STAGING_USERS } from './seed-staging-users.ts';
import {
  loadUserIdentitiesConfig,
  type UserIdentitiesByEnvironment,
  type UserIdentityRecord,
} from './verify-users-container-count.ts';

type JwtClaims = Record<string, unknown>;

interface SeededUserRecord {
  oid: string;
  email: string;
  name: string;
  role: string;
}

interface AuthzProfileResponse {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    accessScope?: {
      canViewAllOrders?: boolean;
      teamIds?: unknown[];
      managedClientIds?: unknown[];
      statesCovered?: unknown[];
    };
    isTestUser?: boolean;
  };
  interpretation?: {
    can_view_all?: boolean;
    teams?: unknown[];
    clients?: unknown[];
    states?: unknown[];
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function decodeBearerClaims(authorizationHeader: string): JwtClaims {
  const token = authorizationHeader.replace(/^Bearer\s+/i, '');
  const decoded = jwt.decode(token);
  if (!isRecord(decoded)) {
    throw new Error('Failed to decode AXIOM_LIVE_BEARER_TOKEN into JWT claims.');
  }
  return decoded;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getTokenEmail(claims: JwtClaims): string {
  const email = claims['email'] ?? claims['preferred_username'] ?? claims['upn'];
  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Live staging authz profile check requires token claim email, preferred_username, or upn.');
  }
  return email.trim();
}

export function getTokenObjectId(claims: JwtClaims): string {
  const oid = claims['oid'] ?? claims['sub'];
  if (typeof oid !== 'string' || !oid.trim()) {
    throw new Error('Live staging authz profile check requires token claim oid or sub.');
  }
  return oid.trim();
}

export function resolveConfiguredIdentity(
  environment: string,
  email: string,
  identitiesByEnvironment: UserIdentitiesByEnvironment,
): UserIdentityRecord {
  const identities = identitiesByEnvironment[environment];
  if (!Array.isArray(identities) || identities.length === 0) {
    throw new Error(`No configured seeded users found for environment "${environment}".`);
  }

  const match = identities.find((identity) => normalizeEmail(identity.upn) === normalizeEmail(email));
  if (!match) {
    throw new Error(
      `Token email "${email}" is not listed in scripts/user-identities.json for environment "${environment}".`,
    );
  }

  return match;
}

export function resolveStagingSeedUser(email: string, oid: string): SeededUserRecord {
  const match = STAGING_USERS.find(
    (user) => normalizeEmail(user.email) === normalizeEmail(email) && user.oid === oid,
  );

  if (!match) {
    throw new Error(
      `Token subject is not present in the checked-in staging seed set. email="${email}", oid="${oid}".`,
    );
  }

  return match;
}

export function validateProfileResponse(
  response: AuthzProfileResponse,
  email: string,
  oid: string,
  expectedRole: string,
): void {
  if (!isRecord(response) || !isRecord(response.user) || !isRecord(response.interpretation)) {
    throw new Error(`Profile endpoint returned an unexpected payload: ${JSON.stringify(response)}`);
  }

  if (response.user.id !== oid) {
    throw new Error(`Profile endpoint user.id mismatch: expected "${oid}", got "${String(response.user.id)}".`);
  }

  if (typeof response.user.email !== 'string' || normalizeEmail(response.user.email) !== normalizeEmail(email)) {
    throw new Error(
      `Profile endpoint user.email mismatch: expected "${email}", got "${String(response.user.email)}".`,
    );
  }

  if (typeof response.user.role !== 'string' || response.user.role.toLowerCase() !== expectedRole.toLowerCase()) {
    throw new Error(
      `Profile endpoint user.role mismatch: expected "${expectedRole}", got "${String(response.user.role)}".`,
    );
  }

  if (response.interpretation.can_view_all !== true) {
    throw new Error(
      `Profile endpoint interpretation.can_view_all must be true for seeded admin users. Received: ${String(response.interpretation.can_view_all)}.`,
    );
  }

  if (response.user.isTestUser === true) {
    throw new Error('Live staging authz profile check must use a real Entra token, not a test token.');
  }
}

export async function main(): Promise<void> {
  const environment = requiredEnv('AXIOM_LIVE_ENVIRONMENT');
  const context = await loadLiveFireContext();
  const identities = await loadUserIdentitiesConfig();
  const claims = decodeBearerClaims(context.authHeader.Authorization);
  const email = getTokenEmail(claims);
  const oid = getTokenObjectId(claims);
  const configuredIdentity = resolveConfiguredIdentity(environment, email, identities);
  let expectedRole = configuredIdentity.role.toLowerCase();

  if (environment === 'staging') {
    expectedRole = resolveStagingSeedUser(email, oid).role;
  }

  logConfig(context, {
    environment,
    tokenEmail: email,
    tokenOid: oid,
    expectedRole: configuredIdentity.role,
  });
  logSection('Profile check');

  const headers = { ...context.authHeader, 'x-tenant-id': context.tenantId };
  const response = await getJson<AuthzProfileResponse>(`${context.baseUrl}/api/authz-test/profile`, headers);
  assertStatus(response.status, [200], 'GET /api/authz-test/profile', response.data);
  validateProfileResponse(response.data, email, oid, expectedRole);

  console.log(`✅ /api/authz-test/profile validated for seeded user ${email} (${oid}).`);
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectRun) {
  void main().catch((error: unknown) => {
    console.error('\n❌ Live authz profile check failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}