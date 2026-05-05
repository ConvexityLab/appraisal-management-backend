/**
 * Property-canonical projection
 *
 * Picks the property-scoped branches out of a built CanonicalReportDocument
 * snapshot fragment so they can be written back to PropertyRecord.currentCanonical
 * for cross-order accumulation.
 *
 * What's property-scoped (accumulates across orders):
 *   - subject              — building characteristics, condition, address, parcel
 *   - transactionHistory   — prior sales / refis (latest order's appraised value
 *                            becomes the next order's prior sale)
 *   - avmCrossCheck        — latest known AVM
 *   - riskFlags            — chain-of-title, geo-competency (property-level signals)
 *
 * What's order-scoped (deliberately NOT projected back):
 *   - comps                — comparable selections are order-specific
 *   - loan / ratios        — different per loan; new ClientOrder = new loan
 *   - valuation /
 *     reconciliation       — the appraised value of THIS order
 *   - compStatistics       — derived from THIS order's comps
 *
 * Returns null when there's nothing property-scoped to write — caller should
 * skip the createVersion call entirely (no-op preserves existing currentCanonical).
 */

import type {
    CanonicalReportDocument,
    CanonicalSubject,
    CanonicalTransactionHistory,
    CanonicalAvmCrossCheck,
    CanonicalRiskFlags,
} from '../types/canonical-schema.js';
import type { PropertyCurrentCanonicalView } from '../types/property-record.types.js';

export function pickPropertyCanonical(
    canonical: Partial<CanonicalReportDocument> | null | undefined,
    metadata?: { snapshotId?: string; lastSnapshotAt?: string },
): PropertyCurrentCanonicalView | null {
    if (!canonical) return null;

    const out: PropertyCurrentCanonicalView = {};

    if (canonical.subject) out.subject = canonical.subject as CanonicalSubject;
    if (canonical.transactionHistory) out.transactionHistory = canonical.transactionHistory as CanonicalTransactionHistory;
    if (canonical.avmCrossCheck) out.avmCrossCheck = canonical.avmCrossCheck as CanonicalAvmCrossCheck;
    if (canonical.riskFlags) out.riskFlags = canonical.riskFlags as CanonicalRiskFlags;

    if (Object.keys(out).length === 0) return null;

    if (metadata?.snapshotId) out.lastSnapshotId = metadata.snapshotId;
    if (metadata?.lastSnapshotAt) out.lastSnapshotAt = metadata.lastSnapshotAt;

    return out;
}

/**
 * Merge a freshly-projected canonical view onto an existing
 * PropertyRecord.currentCanonical, accumulating where appropriate.
 *
 * Merge rules:
 *   - subject              — new view overlays existing (latest snapshot wins
 *                            on overlapping fields; existing-only fields
 *                            survive). Address fields deep-merge so an
 *                            empty-string sentinel doesn't clobber real data.
 *   - transactionHistory   — UNION of subjectPriorTransfers, deduplicated by
 *                            (transactionDate, salePrice). The latest
 *                            snapshot's `priorSale*` and `appreciation*`
 *                            scalars win (they're "most recent" markers).
 *   - avmCrossCheck        — latest wins (it's a snapshot in time).
 *   - riskFlags            — latest wins.
 */
export function mergePropertyCanonical(
    existing: PropertyCurrentCanonicalView | undefined | null,
    incoming: PropertyCurrentCanonicalView,
): PropertyCurrentCanonicalView {
    if (!existing) return incoming;

    const out: PropertyCurrentCanonicalView = { ...existing };

    // Subject: field-by-field merge, address deep-merged with empty-string filtering.
    if (incoming.subject) {
        const existingSubject = (existing.subject ?? {}) as Record<string, unknown>;
        const incomingSubject = incoming.subject as unknown as Record<string, unknown>;
        const merged: Record<string, unknown> = { ...existingSubject };
        for (const [k, v] of Object.entries(incomingSubject)) {
            if (v == null) continue;
            if (typeof v === 'string' && v.trim().length === 0) continue;
            if (k === 'address' && existingSubject['address'] && typeof v === 'object' && !Array.isArray(v)) {
                const existingAddr = existingSubject['address'] as Record<string, unknown>;
                const incomingAddr = v as Record<string, unknown>;
                const mergedAddr: Record<string, unknown> = { ...existingAddr };
                for (const [ak, av] of Object.entries(incomingAddr)) {
                    if (av == null) continue;
                    if (typeof av === 'string' && av.trim().length === 0) continue;
                    mergedAddr[ak] = av;
                }
                merged[k] = mergedAddr;
                continue;
            }
            merged[k] = v;
        }
        out.subject = merged as unknown as CanonicalSubject;
    }

    // transactionHistory: union of priorTransfers, dedup on (date, price).
    if (incoming.transactionHistory) {
        const existingHistory = existing.transactionHistory;
        if (!existingHistory) {
            out.transactionHistory = incoming.transactionHistory;
        } else {
            const incomingTransfers = incoming.transactionHistory.subjectPriorTransfers ?? [];
            const existingTransfers = existingHistory.subjectPriorTransfers ?? [];
            const seen = new Set<string>();
            const merged = [...existingTransfers, ...incomingTransfers].filter((t) => {
                const key = `${t.transactionDate ?? ''}::${t.salePrice ?? ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            // Newest-first by date when present.
            merged.sort((a, b) => {
                if (!a.transactionDate) return 1;
                if (!b.transactionDate) return -1;
                return b.transactionDate.localeCompare(a.transactionDate);
            });
            out.transactionHistory = {
                ...existingHistory,
                ...incoming.transactionHistory,
                subjectPriorTransfers: merged,
            };
        }
    }

    // avmCrossCheck: latest wins.
    if (incoming.avmCrossCheck) out.avmCrossCheck = incoming.avmCrossCheck;
    if (incoming.riskFlags) out.riskFlags = incoming.riskFlags;

    // Stamp metadata from the latest snapshot.
    if (incoming.lastSnapshotId) out.lastSnapshotId = incoming.lastSnapshotId;
    if (incoming.lastSnapshotAt) out.lastSnapshotAt = incoming.lastSnapshotAt;

    return out;
}
