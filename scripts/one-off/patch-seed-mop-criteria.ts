/**
 * One-off patch: seed MOP canonical criteria into AMP's `mop-criteria`
 * Cosmos container.
 *
 * Idempotent: re-running just upserts the same docs. Safe.
 *
 * Run with:
 *   npx tsx scripts/one-off/patch-seed-mop-criteria.ts
 *
 * Bypasses src/scripts/seed/index.ts because that entry point currently has
 * a tsx module-resolution glitch on the mop-criteria seed module's import
 * path. This script is the equivalent of running:
 *   npm run seed:module mop-criteria
 *
 * Caller must be `az login`-ed against the right tenant. Uses
 * DefaultAzureCredential — no Cosmos key required.
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { ALL_CANONICAL_MOP_CRITERIA } from '../../src/data/mop-criteria.js';

async function main(): Promise<void> {
    const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
    const databaseId = process.env.COSMOS_DATABASE_NAME ?? process.env.AZURE_COSMOS_DATABASE_NAME;

    if (!endpoint) throw new Error('COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    if (!databaseId) throw new Error('COSMOS_DATABASE_NAME (or AZURE_COSMOS_DATABASE_NAME) is required.');

    console.log(`Cosmos endpoint:  ${endpoint}`);
    console.log(`Database:         ${databaseId}`);
    console.log(`Container:        mop-criteria`);
    console.log(`Canonicals:       ${ALL_CANONICAL_MOP_CRITERIA.length}`);
    console.log('');

    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const container = client.database(databaseId).container('mop-criteria');

    let upserted = 0;
    for (const def of ALL_CANONICAL_MOP_CRITERIA) {
        await container.items.upsert(def);
        console.log(`  [upserted] ${def.id}  programId=${def.programId} v${def.programVersion} tier=${def.tier}`);
        upserted++;
    }

    console.log('');
    console.log(`Done. upserted=${upserted}`);
}

main().catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
});
