#!/usr/bin/env tsx
/**
 * Seed report-config documents into Cosmos DB.
 *
 * Upserts:
 *   report-config-base     ← URAR 1004 base document
 *   report-config-deltas   ← all product deltas (8 products) + client delta (client-demo-001)
 *
 * Idempotent — uses document `id` as the upsert key. No createIfNotExists.
 *
 * Usage:
 *   npx tsx --env-file .env src/scripts/seed-report-config.ts
 *
 * Required env vars:
 *   COSMOS_ENDPOINT  (or AZURE_COSMOS_ENDPOINT)
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { URAR_1004_BASE } from '../seed-data/report-config/urar-1004-base.js';
import { DELTA_FULL_1004 } from '../seed-data/report-config/delta-full-1004.js';
import { DELTA_URAR_1073 } from '../seed-data/report-config/delta-urar-1073.js';
import { DELTA_BPO } from '../seed-data/report-config/delta-bpo.js';
import { DELTA_DRIVE_BY_2055 } from '../seed-data/report-config/delta-drive-by-2055.js';
import { DELTA_DESKTOP_REVIEW } from '../seed-data/report-config/delta-desktop-review.js';
import { DELTA_MULTI_FAMILY_1025 } from '../seed-data/report-config/delta-multi-family-1025.js';
import { DELTA_FIELD_REVIEW_2000 } from '../seed-data/report-config/delta-field-review-2000.js';
import { DELTA_RECERTIFICATION } from '../seed-data/report-config/delta-recertification.js';
import { DELTA_ROV } from '../seed-data/report-config/delta-rov.js';
import { DELTA_CLIENT_DEMO_001 } from '../seed-data/report-config/delta-client-demo-001.js';

const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
if (!endpoint) {
  console.error('ERROR: COSMOS_ENDPOINT env var is not set.');
  process.exit(1);
}

const DB_NAME = 'appraisal-management';
const BASE_CONTAINER = 'report-config-base';
const DELTAS_CONTAINER = 'report-config-deltas';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database(DB_NAME);

async function upsert(containerName: string, doc: { id: string }): Promise<void> {
  const container = db.container(containerName);
  const { statusCode, resource } = await container.items.upsert(doc);
  console.log(`  [${statusCode}] ${containerName}/${resource?.id ?? doc.id}`);
}

async function main(): Promise<void> {
  console.log(`Seeding report-config documents into ${DB_NAME}…`);

  console.log('\n[report-config-base]');
  await upsert(BASE_CONTAINER, URAR_1004_BASE);

  console.log('\n[report-config-deltas]');
  // Product deltas (8 products)
  await upsert(DELTAS_CONTAINER, DELTA_FULL_1004);
  await upsert(DELTAS_CONTAINER, DELTA_URAR_1073);
  await upsert(DELTAS_CONTAINER, DELTA_BPO);
  await upsert(DELTAS_CONTAINER, DELTA_DRIVE_BY_2055);
  await upsert(DELTAS_CONTAINER, DELTA_DESKTOP_REVIEW);
  await upsert(DELTAS_CONTAINER, DELTA_MULTI_FAMILY_1025);
  await upsert(DELTAS_CONTAINER, DELTA_FIELD_REVIEW_2000);
  await upsert(DELTAS_CONTAINER, DELTA_RECERTIFICATION);
  await upsert(DELTAS_CONTAINER, DELTA_ROV);
  // Client deltas
  await upsert(DELTAS_CONTAINER, DELTA_CLIENT_DEMO_001);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
