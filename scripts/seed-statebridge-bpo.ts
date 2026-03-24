/**
 * Seed Statebridge / VisionOne BPO Document Type and Schema
 *
 * This script upserts two documents into Axiom's Cosmos containers:
 *
 *   DocumentTypeRegistry  ← seed-data/document-types/bpo-registry.json
 *   DocumentSchemas       ← seed-data/schemas/bpo-schema-v1.0.json
 *
 * Identity:
 *   clientId  = "visionone"
 *   tenantId  = "statebridge-tenant"
 *
 * Safe to run multiple times — all writes are upserts.
 *
 * Usage:
 *   npx tsx scripts/seed-statebridge-bpo.ts
 *
 * Requires:
 *   COSMOS_ENDPOINT      — Axiom Cosmos account endpoint
 *   COSMOS_DATABASE_ID   — Axiom database name
 *   (auth via DefaultAzureCredential — managed identity / az login)
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SEED_ROOT = path.resolve(__dirname, '..', 'seed-data');

function loadJson(filePath: string): Record<string, unknown> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
}

async function main(): Promise<void> {
    const endpoint = process.env['COSMOS_ENDPOINT'];
    const databaseId = process.env['COSMOS_DATABASE_ID'];

    if (!endpoint) throw new Error('COSMOS_ENDPOINT is required — set it in .env or the environment');
    if (!databaseId) throw new Error('COSMOS_DATABASE_ID is required — set it in .env or the environment');

    const cosmosClient = new CosmosClient({
        endpoint,
        aadCredentials: new DefaultAzureCredential(),
    });

    const db = cosmosClient.database(databaseId);
    const registryContainer = db.container('DocumentTypeRegistry');
    const schemasContainer = db.container('DocumentSchemas');

    // ── Load JSON files ───────────────────────────────────────────────────────
    const registryDoc = loadJson(
        path.join(SEED_ROOT, 'document-types', 'bpo-registry.json'),
    );
    const schemaDoc = loadJson(
        path.join(SEED_ROOT, 'schemas', 'bpo-schema-v1.0.json'),
    );

    console.log('\n' + '='.repeat(60));
    console.log('SEED: Statebridge / VisionOne — BPO Document Type + Schema');
    console.log('='.repeat(60));
    console.log(`  Cosmos endpoint  : ${endpoint}`);
    console.log(`  Database         : ${databaseId}`);
    console.log(`  clientId         : ${registryDoc['clientId']}`);
    console.log(`  tenantId         : ${registryDoc['tenantId']}`);
    console.log(`  Registry ID      : ${registryDoc['id']}`);
    console.log(`  Schema ID        : ${schemaDoc['id']}`);

    // ── Upsert DocumentTypeRegistry ──────────────────────────────────────────
    console.log('\n📋 Upserting DocumentTypeRegistry entry...');
    await registryContainer.items.upsert(registryDoc);
    console.log(`  ✅ ${registryDoc['id']}`);

    // ── Upsert DocumentSchemas ────────────────────────────────────────────────
    console.log('\n📐 Upserting DocumentSchemas entry...');
    await schemasContainer.items.upsert(schemaDoc);
    const fieldCount = Array.isArray(schemaDoc['fields']) ? (schemaDoc['fields'] as unknown[]).length : 0;
    console.log(`  ✅ ${schemaDoc['id']} (${fieldCount} fields)`);

    // ── Verify round-trip ─────────────────────────────────────────────────────
    console.log('\n🔍 Verifying documents are readable from Cosmos...');

    const { resource: verifyRegistry } = await registryContainer
        .item(registryDoc['id'] as string, [registryDoc['clientId'], registryDoc['tenantId']])
        .read();
    if (!verifyRegistry) throw new Error(`Registry read-back failed for id=${registryDoc['id']}`);
    console.log(`  ✅ Registry verified: isEnabled=${verifyRegistry.isEnabled}, extractionRequired=${verifyRegistry.extractionRequired}`);

    const { resource: verifySchema } = await schemasContainer
        .item(schemaDoc['id'] as string, [schemaDoc['clientId'], schemaDoc['tenantId']])
        .read();
    if (!verifySchema) throw new Error(`Schema read-back failed for id=${schemaDoc['id']}`);
    const verifiedFieldCount = Array.isArray(verifySchema.fields) ? verifySchema.fields.length : 0;
    console.log(`  ✅ Schema verified: version=${verifySchema.version}, fields=${verifiedFieldCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('SEED COMPLETE — Statebridge BPO ready in Axiom');
    console.log('='.repeat(60));
    console.log('\nNext: Verify with scripts/check-registry-contents.ts or query Cosmos directly.');
}

main().catch((err: unknown) => {
    console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
