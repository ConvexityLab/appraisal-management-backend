#!/usr/bin/env tsx

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const USERS_CONTAINER = 'users';

export interface UserIdentityRecord {
  upn: string;
  role: string;
  clientId: string;
  subClientId: string;
}

export type UserIdentitiesByEnvironment = Record<string, UserIdentityRecord[]>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function resolveExpectedUsersCount(
  environment: string,
  identitiesByEnvironment: UserIdentitiesByEnvironment,
): number {
  const identities = identitiesByEnvironment[environment];
  if (!Array.isArray(identities) || identities.length < 1) {
    throw new Error(
      `No seeded user identities are configured for environment "${environment}" in scripts/user-identities.json.`,
    );
  }

  return identities.length;
}

export async function loadUserIdentitiesConfig(configPath?: string): Promise<UserIdentitiesByEnvironment> {
  const resolvedPath = configPath ?? path.resolve(__dirname, '..', 'user-identities.json');
  const raw = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(raw) as UserIdentitiesByEnvironment;
}

export function validateUsersCount(count: number, expectedMinimumCount: number, environment: string): void {
  if (!Number.isFinite(expectedMinimumCount) || expectedMinimumCount < 1) {
    throw new Error(
      `Users container smoke check misconfigured for environment "${environment}": expectedMinimumCount must be at least 1, got ${expectedMinimumCount}.`,
    );
  }

  if (!Number.isFinite(count) || count < expectedMinimumCount) {
    throw new Error(
      `Users container smoke check failed for environment "${environment}": expected at least ${expectedMinimumCount} document(s) in "${USERS_CONTAINER}", got ${count}. ` +
      'Seed user profiles before continuing to production cutover.',
    );
  }
}

export async function getUsersCount(endpoint: string, databaseName: string): Promise<number> {
  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  const container = client.database(databaseName).container(USERS_CONTAINER);
  const { resources } = await container.items.query<number>('SELECT VALUE COUNT(1) FROM c').fetchAll();
  return resources[0] ?? 0;
}

export async function main(): Promise<void> {
  const endpoint = requiredEnv('COSMOS_ENDPOINT');
  const databaseName = requiredEnv('COSMOS_DATABASE_NAME');
  const environment = requiredEnv('DEPLOY_ENVIRONMENT');
  const identities = await loadUserIdentitiesConfig();
  const expectedMinimumCount = resolveExpectedUsersCount(environment, identities);

  console.log('========================================================');
  console.log(' Smoke check: verify seeded users container documents');
  console.log('========================================================');
  console.log(`  Endpoint : ${endpoint}`);
  console.log(`  Database : ${databaseName}`);
  console.log(`  Container: ${USERS_CONTAINER}`);
  console.log(`  Environment: ${environment}`);
  console.log(`  Expected minimum documents: ${expectedMinimumCount}`);

  const count = await getUsersCount(endpoint, databaseName);
  validateUsersCount(count, expectedMinimumCount, environment);

  console.log(`\n✅ Users container check passed: ${count} document(s) found (minimum ${expectedMinimumCount}).\n`);
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error('\n❌ Users container smoke check failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}