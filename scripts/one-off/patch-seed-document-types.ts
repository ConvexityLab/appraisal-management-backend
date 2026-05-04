/**
 * One-off patch: stamp `documentType` on the four seed appraisal-report documents
 * so review-program criteria (which match by Axiom document-type registry id)
 * resolve correctly.
 *
 * Idempotent: re-running just re-applies the same field. Safe.
 *
 * Run with:
 *   npx tsx scripts/one-off/patch-seed-document-types.ts
 *
 * Targets the Cosmos endpoint configured via COSMOS_ENDPOINT / COSMOS_DATABASE_NAME
 * env vars (same vars AMP itself reads). Uses DefaultAzureCredential — no key
 * required. Caller must be `az login`-ed against the right tenant.
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const TARGETS = [
    'seed-doc-report-001',
    'seed-doc-report-003',
    'seed-doc-report-009',
    'seed-doc-report-012',
] as const;

const NEW_DOCUMENT_TYPE = 'uniform-residential-appraisal-report';

async function main(): Promise<void> {
    const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
    const databaseId = process.env.COSMOS_DATABASE_NAME ?? process.env.AZURE_COSMOS_DATABASE_NAME;

    if (!endpoint) throw new Error('COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    if (!databaseId) throw new Error('COSMOS_DATABASE_NAME (or AZURE_COSMOS_DATABASE_NAME) is required.');

    console.log(`Cosmos endpoint:  ${endpoint}`);
    console.log(`Database:         ${databaseId}`);
    console.log(`Container:        documents`);
    console.log(`documentType:     ${NEW_DOCUMENT_TYPE}`);
    console.log(`Targets:          ${TARGETS.join(', ')}`);
    console.log('');

    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const container = client.database(databaseId).container('documents');

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const id of TARGETS) {
        const { resources } = await container.items
            .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
            .fetchAll();

        if (resources.length === 0) {
            console.log(`  [not found] ${id}`);
            notFound++;
            continue;
        }
        const doc = resources[0] as Record<string, unknown>;
        if (doc.documentType === NEW_DOCUMENT_TYPE) {
            console.log(`  [skip]      ${id}  (already has documentType=${NEW_DOCUMENT_TYPE})`);
            skipped++;
            continue;
        }
        const next = { ...doc, documentType: NEW_DOCUMENT_TYPE };
        await container.items.upsert(next);
        console.log(`  [patched]   ${id}  (was: ${doc.documentType ?? '(unset)'})`);
        updated++;
    }

    console.log('');
    console.log(`Done. patched=${updated}  skipped=${skipped}  notFound=${notFound}`);
}

main().catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
});
