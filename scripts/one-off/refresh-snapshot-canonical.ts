/**
 * One-off: refresh `normalizedData.canonical` on the latest canonical-snapshot
 * for a given orderId by re-running the axiom-extraction mapper against the
 * stored extraction data.
 *
 * Use case: after shipping the AxiomExtractionMapper for the first time,
 * existing snapshots in Cosmos have no `canonical` field because they were
 * built before the mapper existed. Production-going-forward this happens
 * automatically on the next extraction; this script back-fills.
 *
 * Run with:
 *   npx tsx scripts/one-off/refresh-snapshot-canonical.ts <orderId>
 *
 * Idempotent. Uses DefaultAzureCredential — caller must be `az login`-ed.
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { mapAxiomExtractionToCanonical } from '../../src/mappers/axiom-extraction.mapper.js';

async function main(): Promise<void> {
    const orderId = process.argv[2];
    if (!orderId) throw new Error('Usage: tsx refresh-snapshot-canonical.ts <orderId>');

    const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
    const databaseId = process.env.COSMOS_DATABASE_NAME ?? process.env.AZURE_COSMOS_DATABASE_NAME;
    if (!endpoint) throw new Error('COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    if (!databaseId) throw new Error('COSMOS_DATABASE_NAME (or AZURE_COSMOS_DATABASE_NAME) is required.');

    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const aiInsights = client.database(databaseId).container('aiInsights');

    console.log(`Refreshing canonical-snapshot for orderId=${orderId}`);
    console.log(`Cosmos: ${endpoint} / ${databaseId} / aiInsights`);

    // Find the latest canonical-snapshot whose source extraction-run targeted this order.
    // Snapshots track the source via sourceRefs[].sourceId; the run-ledger row has
    // loanPropertyContextId = orderId. We query both containers and join in code.
    const { resources: snapshots } = await aiInsights.items
        .query({
            query: `SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC`,
            parameters: [{ name: '@type', value: 'canonical-snapshot' }],
        })
        .fetchAll();

    // Find runs for this order to map back to which snapshots came from extraction
    // runs of this order.
    const { resources: runs } = await aiInsights.items
        .query({
            query: `SELECT c.id, c.loanPropertyContextId FROM c WHERE c.type = @t AND c.loanPropertyContextId = @o`,
            parameters: [
                { name: '@t', value: 'run-ledger-entry' },
                { name: '@o', value: orderId },
            ],
        })
        .fetchAll();
    const runIdsForOrder = new Set(runs.map((r) => r.id as string));

    const matchingSnapshots = snapshots.filter((s: any) =>
        Array.isArray(s.sourceRefs) && s.sourceRefs.some((r: any) => runIdsForOrder.has(r.sourceRunId)),
    );
    console.log(`Found ${matchingSnapshots.length} snapshots for this order (newest first).`);

    let refreshed = 0;
    let alreadyFresh = 0;
    let noExtraction = 0;

    for (const snap of matchingSnapshots) {
        const s = snap as Record<string, unknown> & {
            id: string;
            normalizedData?: {
                extraction?: Record<string, unknown>;
                canonical?: Record<string, unknown>;
            };
        };
        const hasCanonical = s.normalizedData?.canonical && Object.keys(s.normalizedData.canonical).length > 0;
        const hasExtraction = s.normalizedData?.extraction && Object.keys(s.normalizedData.extraction).length > 0;
        if (!hasExtraction) {
            console.log(`  [skip:no-extraction] ${s.id}`);
            noExtraction++;
            continue;
        }
        if (hasCanonical) {
            console.log(`  [skip:already-fresh] ${s.id}  (canonical keys=${Object.keys(s.normalizedData!.canonical!).length})`);
            alreadyFresh++;
            continue;
        }
        const canonical = mapAxiomExtractionToCanonical(s.normalizedData!.extraction) as Record<string, unknown>;
        const next = {
            ...s,
            normalizedData: {
                ...(s.normalizedData ?? {}),
                canonical,
            },
            refreshedAt: new Date().toISOString(),
        };
        await aiInsights.items.upsert(next);
        console.log(`  [refreshed] ${s.id}  → canonical keys=${Object.keys(canonical).length} (${Object.keys(canonical).join(', ')})`);
        refreshed++;
    }

    console.log('');
    console.log(`Done. refreshed=${refreshed}  alreadyFresh=${alreadyFresh}  noExtraction=${noExtraction}`);
}

main().catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
});
