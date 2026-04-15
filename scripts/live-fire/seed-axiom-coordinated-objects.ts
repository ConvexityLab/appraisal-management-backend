#!/usr/bin/env tsx

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

interface SeedConfig {
  tenantId: string;
  clientId: string;
  subClientId: string;
  programId: string;
  programVersion: string;
  documentSchemaVersion: string;
  criteriaStepKeys: string[];
  initiatedBy: string;
  mode: 'check-only' | 'seed';
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function readOptional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function loadConfig(): SeedConfig {
  const modeRaw = readOptional('AXIOM_COORD_MODE', 'seed').toLowerCase();
  if (modeRaw !== 'seed' && modeRaw !== 'check-only') {
    throw new Error(`AXIOM_COORD_MODE must be 'seed' or 'check-only'. Received: ${modeRaw}`);
  }

  const criteriaStepKeysRaw = readOptional('AXIOM_COORD_CRITERIA_STEP_KEYS', 'overall-criteria');
  const criteriaStepKeys = criteriaStepKeysRaw.split(',').map((value) => value.trim()).filter(Boolean);
  if (criteriaStepKeys.length === 0) {
    throw new Error('AXIOM_COORD_CRITERIA_STEP_KEYS must contain at least one step key');
  }

  return {
    tenantId: readRequired('AXIOM_COORD_TENANT_ID'),
    clientId: readRequired('AXIOM_COORD_CLIENT_ID'),
    subClientId: readRequired('AXIOM_COORD_SUBCLIENT_ID'),
    programId: readOptional('AXIOM_COORD_PROGRAM_ID', 'FNMA-URAR'),
    programVersion: readOptional('AXIOM_COORD_PROGRAM_VERSION', '1.0.0'),
    documentSchemaVersion: readOptional('AXIOM_COORD_DOCUMENT_SCHEMA_VERSION', '1.0.0'),
    criteriaStepKeys,
    initiatedBy: readOptional('AXIOM_COORD_INITIATED_BY', 'live-fire-seed-script'),
    mode: modeRaw,
  };
}

async function ensureContainerExists(client: CosmosClient, dbName: string, containerName: string): Promise<void> {
  const database = client.database(dbName);
  const container = database.container(containerName);
  try {
    await container.read();
  } catch (error) {
    throw new Error(
      `Required container '${containerName}' is missing in database '${dbName}'. ` +
      `This script does not create infrastructure. Provision the container first.`,
    );
  }
}

async function upsertTenantAutomationConfig(client: CosmosClient, dbName: string, config: SeedConfig): Promise<void> {
  const container = client.database(dbName).container('tenant-automation-configs');
  const now = new Date().toISOString();

  const document = {
    id: `automation-config-${config.tenantId}`,
    tenantId: config.tenantId,
    entityType: 'tenant-automation-config',

    autoAssignmentEnabled: true,
    bidLoopEnabled: true,
    maxVendorAttempts: 5,
    bidExpiryHours: 4,
    reviewExpiryHours: 8,
    supervisorTimeoutHours: 8,
    preferredVendorIds: [],
    supervisoryReviewForAllOrders: false,
    supervisoryReviewValueThreshold: 0,
    escalationRecipients: [],
    aiQcEnabled: false,
    aiQcPassThreshold: 90,
    aiQcFlagThreshold: 70,
    autoDeliveryEnabled: true,
    autoCloseEngagementEnabled: true,
    bidMode: 'sequential',
    broadcastCount: 5,
    engagementLetterAutoSend: true,
    requireSignedLetterBeforeProgress: false,

    axiomAutoTrigger: true,
    axiomTimeoutMinutes: 10,
    axiomProgramId: config.programId,
    axiomProgramVersion: config.programVersion,
    axiomSubClientId: config.subClientId,
    axiomDocumentSchemaVersion: config.documentSchemaVersion,
    axiomDefaultCriteriaStepKeys: config.criteriaStepKeys,

    updatedAt: now,
    updatedBy: config.initiatedBy,
    createdAt: now,
  };

  await container.items.upsert(document);
}

async function upsertReviewProgram(client: CosmosClient, dbName: string, config: SeedConfig): Promise<void> {
  const container = client.database(dbName).container('review-programs');
  const now = new Date().toISOString();
  const id = `seed-review-program-${config.clientId}-${config.subClientId}-${config.programId}-${config.programVersion}`;

  const document = {
    id,
    tenantId: config.tenantId,
    clientId: config.clientId,
    subClientId: config.subClientId,
    programId: config.programId,
    version: config.programVersion,
    name: `${config.programId} ${config.programVersion} (${config.clientId}/${config.subClientId})`,
    status: 'ACTIVE',
    type: 'review-program',
    createdAt: now,
    updatedAt: now,
    createdBy: config.initiatedBy,
    updatedBy: config.initiatedBy,
  };

  await container.items.upsert(document);
}

async function upsertCriteriaRows(client: CosmosClient, dbName: string, config: SeedConfig): Promise<void> {
  const container = client.database(dbName).container('criteria');
  const now = new Date().toISOString();

  for (const stepKey of config.criteriaStepKeys) {
    const id = `seed-criteria-${config.clientId}-${config.subClientId}-${config.programId}-${config.programVersion}-${stepKey}`;
    const document = {
      id,
      tenantId: config.tenantId,
      clientId: config.clientId,
      subClientId: config.subClientId,
      programId: config.programId,
      programVersion: config.programVersion,
      programKey: `${config.clientId}:${config.subClientId}:${config.programId}:${config.programVersion}`,
      stepKey,
      criterionCode: `${stepKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SEED`,
      criterionId: `${config.programId}-${stepKey}`,
      status: 'ACTIVE',
      source: 'live-fire-coordinated-seed',
      createdAt: now,
      updatedAt: now,
      createdBy: config.initiatedBy,
      updatedBy: config.initiatedBy,
    };

    await container.items.upsert(document);
  }
}

async function verifyCoverage(client: CosmosClient, dbName: string, config: SeedConfig): Promise<void> {
  const db = client.database(dbName);

  const tenantConfigRows = await db.container('tenant-automation-configs').items.query<any>({
    query: `SELECT TOP 1 c.id, c.tenantId, c.axiomSubClientId, c.axiomProgramId, c.axiomProgramVersion, c.axiomDocumentSchemaVersion
            FROM c
            WHERE c.tenantId=@tenantId AND c.entityType='tenant-automation-config'`,
    parameters: [{ name: '@tenantId', value: config.tenantId }],
  }).fetchAll();

  const reviewProgramRows = await db.container('review-programs').items.query<any>({
    query: `SELECT TOP 3 c.id, c.clientId, c.subClientId, c.programId, c.version, c.status
            FROM c
            WHERE c.clientId=@clientId AND c.subClientId=@subClientId`,
    parameters: [
      { name: '@clientId', value: config.clientId },
      { name: '@subClientId', value: config.subClientId },
    ],
  }).fetchAll();

  const criteriaRows = await db.container('criteria').items.query<any>({
    query: `SELECT TOP 20 c.id, c.clientId, c.subClientId, c.programId, c.programVersion, c.stepKey, c.status
            FROM c
            WHERE c.clientId=@clientId AND c.subClientId=@subClientId AND c.programId=@programId AND c.programVersion=@programVersion`,
    parameters: [
      { name: '@clientId', value: config.clientId },
      { name: '@subClientId', value: config.subClientId },
      { name: '@programId', value: config.programId },
      { name: '@programVersion', value: config.programVersion },
    ],
  }).fetchAll();

  console.log('\n=== Coordinated Axiom Object Coverage ===');
  console.log(`tenant-automation-configs rows: ${tenantConfigRows.resources.length}`);
  if (tenantConfigRows.resources[0]) {
    console.log(JSON.stringify(tenantConfigRows.resources[0]));
  }

  console.log(`review-programs rows for client/subClient: ${reviewProgramRows.resources.length}`);
  for (const row of reviewProgramRows.resources) {
    console.log(JSON.stringify(row));
  }

  console.log(`criteria rows for program key: ${criteriaRows.resources.length}`);
  for (const row of criteriaRows.resources) {
    console.log(JSON.stringify(row));
  }

  if (tenantConfigRows.resources.length === 0) {
    throw new Error('Missing tenant automation config row.');
  }
  if (reviewProgramRows.resources.length === 0) {
    throw new Error('Missing review program row for client/subClient.');
  }
  if (criteriaRows.resources.length === 0) {
    throw new Error('Missing criteria rows for client/subClient/program/version.');
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const endpoint = readRequired('COSMOS_ENDPOINT');
  const dbName = readRequired('COSMOS_DATABASE_NAME');

  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  await ensureContainerExists(client, dbName, 'tenant-automation-configs');
  await ensureContainerExists(client, dbName, 'review-programs');
  await ensureContainerExists(client, dbName, 'criteria');

  console.log('Mode:', config.mode);
  console.log('Tenant:', config.tenantId);
  console.log('Client/SubClient:', `${config.clientId} / ${config.subClientId}`);
  console.log('Program:', `${config.programId} v${config.programVersion}`);
  console.log('Criteria step keys:', config.criteriaStepKeys.join(','));

  if (config.mode === 'seed') {
    await upsertTenantAutomationConfig(client, dbName, config);
    await upsertReviewProgram(client, dbName, config);
    await upsertCriteriaRows(client, dbName, config);
  }

  await verifyCoverage(client, dbName, config);
  console.log('\n✅ Coordinated Axiom object check passed.');
}

main().catch((error) => {
  console.error(`\n❌ Coordinated object seed/check failed: ${(error as Error).message}`);
  process.exit(1);
});
