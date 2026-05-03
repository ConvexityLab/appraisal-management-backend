/**
 * One-off: back-fill document.extractedData and snapshot.normalizedData
 * (extraction + canonical) for an order whose Axiom extraction completed
 * but never landed in document.extractedData.
 *
 * Why this is needed: a separate gap in AMP's extraction-completion handler
 * is leaving document.extractedData unpopulated even after a successful
 * 17-page Axiom extraction. The data lives on the eval record's
 * axiomExtractionResult[] array. This script reconstructs document.extractedData
 * from that, then refreshes the snapshot's normalizedData.{extraction,canonical}
 * via the AxiomExtractionMapper.
 *
 * The extraction-handler bug itself should be fixed separately. This script
 * unblocks `seed-order-003` so review-program dispatch can proceed.
 *
 * Run:
 *   npx tsx scripts/one-off/backfill-extraction-and-canonical.ts <orderId>
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { mapAxiomExtractionToCanonical } from '../../src/mappers/axiom-extraction.mapper.js';

interface PageResult {
    extractedData?: Record<string, unknown>;
}

interface EvalRecord {
    id: string;
    status?: string;
    timestamp?: string;
    documentId?: string;
    axiomExtractionResult?: PageResult[];
}

interface DocRecord {
    id: string;
    tenantId: string;
    extractedData?: Record<string, unknown>;
    [key: string]: unknown;
}

interface SnapshotRecord {
    id: string;
    tenantId: string;
    normalizedData?: {
        subjectProperty?: Record<string, unknown>;
        extraction?: Record<string, unknown>;
        canonical?: Record<string, unknown>;
        providerData?: Record<string, unknown>;
        provenance?: Record<string, unknown>;
    };
    sourceRefs?: Array<{ sourceRunId?: string }>;
    [key: string]: unknown;
}

/**
 * Merge page-level extractedData across an Axiom result array.
 * For each top-level key, takes the FIRST non-null occurrence across pages.
 * Object-valued keys are deep-merged recursively.
 */
function mergePageResults(pages: PageResult[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const page of pages) {
        const data = page?.extractedData;
        if (!data || typeof data !== 'object') continue;
        for (const [key, val] of Object.entries(data)) {
            mergeKey(out, key, val);
        }
    }
    return out;
}

function mergeKey(target: Record<string, unknown>, key: string, incoming: unknown): void {
    if (incoming == null) return;
    const existing = target[key];
    // Both objects (not arrays) — deep merge.
    if (
        existing != null && typeof existing === 'object' && !Array.isArray(existing)
        && typeof incoming === 'object' && !Array.isArray(incoming)
    ) {
        const merged = { ...(existing as Record<string, unknown>) };
        for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
            mergeKey(merged, k, v);
        }
        target[key] = merged;
        return;
    }
    // First-write-wins: only set if not already present.
    if (existing == null) {
        target[key] = incoming;
    }
}

async function main(): Promise<void> {
    const orderId = process.argv[2];
    if (!orderId) throw new Error('Usage: tsx backfill-extraction-and-canonical.ts <orderId>');

    const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
    const dbId = process.env.COSMOS_DATABASE_NAME ?? process.env.AZURE_COSMOS_DATABASE_NAME;
    if (!endpoint || !dbId) throw new Error('Set COSMOS_ENDPOINT and COSMOS_DATABASE_NAME.');

    const c = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const ai = c.database(dbId).container('aiInsights');
    const docs = c.database(dbId).container('documents');

    console.log(`Backfilling for orderId=${orderId}`);

    // 1. Find the latest eval that has axiomExtractionResult populated.
    const { resources: evals } = await ai.items.query({
        query: "SELECT TOP 1 * FROM c WHERE c.orderId = @o AND STARTSWITH(c.id, 'eval-') AND IS_DEFINED(c.axiomExtractionResult) AND ARRAY_LENGTH(c.axiomExtractionResult) > 0 ORDER BY c.timestamp DESC",
        parameters: [{ name: '@o', value: orderId }],
    }).fetchAll();
    const ev = evals[0] as EvalRecord | undefined;
    if (!ev) {
        console.log('  [no-eval] no eval with axiomExtractionResult found — nothing to back-fill.');
        return;
    }
    console.log(`  source eval: ${ev.id}  pages=${ev.axiomExtractionResult?.length}  timestamp=${ev.timestamp}`);

    // 2. Merge page-level extractedData.
    const merged = mergePageResults(ev.axiomExtractionResult ?? []);
    const mergedKeys = Object.keys(merged);
    console.log(`  merged extraction keys (${mergedKeys.length}): ${mergedKeys.join(', ')}`);
    if (mergedKeys.length === 0) {
        console.log('  [empty-merge] all pages have null extractedData; nothing to write.');
        return;
    }

    // 3. Write back to the document. We need the documentId; it's on the eval
    // (or the linked snapshot's source-document). Try eval first.
    let docId = ev.documentId;
    if (!docId) {
        // Fall back: find a document attached to this orderId.
        const { resources: docCandidates } = await docs.items.query({
            query: "SELECT TOP 1 c.id FROM c WHERE c.orderId = @o AND c.documentType = 'uniform-residential-appraisal-report'",
            parameters: [{ name: '@o', value: orderId }],
        }).fetchAll();
        docId = (docCandidates[0] as { id?: string } | undefined)?.id;
    }
    if (!docId) throw new Error(`Could not resolve documentId for order ${orderId}.`);

    const { resources: docResults } = await docs.items.query({
        query: 'SELECT * FROM c WHERE c.id = @i',
        parameters: [{ name: '@i', value: docId }],
    }).fetchAll();
    const doc = docResults[0] as DocRecord | undefined;
    if (!doc) throw new Error(`Document ${docId} not found.`);

    const docNext = { ...doc, extractedData: merged };
    await docs.items.upsert(docNext);
    console.log(`  [doc:patched] ${docId} ← extractedData (${mergedKeys.length} keys)`);

    // 4. Patch the latest snapshot for this order with normalizedData.{extraction,canonical}.
    const { resources: runs } = await ai.items.query({
        query: 'SELECT c.id FROM c WHERE c.type = @t AND c.loanPropertyContextId = @o',
        parameters: [{ name: '@t', value: 'run-ledger-entry' }, { name: '@o', value: orderId }],
    }).fetchAll();
    const runIds = new Set(runs.map((r) => r.id as string));

    const { resources: snapshots } = await ai.items.query({
        query: 'SELECT * FROM c WHERE c.type = @t ORDER BY c.createdAt DESC',
        parameters: [{ name: '@t', value: 'canonical-snapshot' }],
    }).fetchAll();
    const matching = (snapshots as SnapshotRecord[]).filter((s) =>
        Array.isArray(s.sourceRefs) && s.sourceRefs.some((r) => r?.sourceRunId && runIds.has(r.sourceRunId)),
    );
    console.log(`  found ${matching.length} snapshots for this order; refreshing latest 1`);

    if (matching.length === 0) {
        console.log('  [no-snapshot] no snapshot found for this order. Document is patched; next prepare will read fresh.');
        return;
    }

    const latest = matching[0]!;
    const canonical = mapAxiomExtractionToCanonical(merged) as Record<string, unknown>;
    const next = {
        ...latest,
        normalizedData: {
            ...(latest.normalizedData ?? {}),
            extraction: merged,
            canonical,
        },
        refreshedAt: new Date().toISOString(),
    };
    await ai.items.upsert(next);
    console.log(`  [snapshot:patched] ${latest.id} ← extraction (${mergedKeys.length} keys), canonical (${Object.keys(canonical).join(', ')})`);
    console.log('Done.');
}

main().catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
});
