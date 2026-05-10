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

export const PROPERTY_CANONICAL_PROJECTOR_VERSION = '2026-05-10.1';

function asUnknownRecord<T>(value: T): Record<string, unknown> {
    return value as unknown as Record<string, unknown>;
}

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
    const incomingIsNewerOrEqual = isIncomingNewerOrEqual(existing.lastSnapshotAt, incoming.lastSnapshotAt);

    // Subject: recursively merge objects, ignore empty-string/null sentinels, and
    // only let stale snapshots backfill missing values instead of clobbering newer ones.
    if (incoming.subject) {
        out.subject = mergeCanonicalBranch(
            existing.subject as Record<string, unknown> | undefined,
            incoming.subject as unknown as Record<string, unknown>,
            incomingIsNewerOrEqual,
        ) as unknown as CanonicalSubject;
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
            out.transactionHistory = mergeCanonicalBranch(
                asUnknownRecord(existingHistory),
                asUnknownRecord(incoming.transactionHistory),
                incomingIsNewerOrEqual,
            ) as unknown as CanonicalTransactionHistory;
            out.transactionHistory.subjectPriorTransfers = merged;
        }
    }

    // avmCrossCheck / riskFlags: newest snapshot wins; stale snapshots only backfill.
    if (incoming.avmCrossCheck) {
        out.avmCrossCheck = mergeCanonicalBranch(
            existing.avmCrossCheck ? asUnknownRecord(existing.avmCrossCheck) : undefined,
            asUnknownRecord(incoming.avmCrossCheck),
            incomingIsNewerOrEqual,
        ) as unknown as CanonicalAvmCrossCheck;
    }
    if (incoming.riskFlags) {
        out.riskFlags = mergeCanonicalBranch(
            existing.riskFlags ? asUnknownRecord(existing.riskFlags) : undefined,
            asUnknownRecord(incoming.riskFlags),
            incomingIsNewerOrEqual,
        ) as unknown as CanonicalRiskFlags;
    }

    // Stamp metadata only when this snapshot is at least as new as the current winner,
    // or when there was no winning snapshot yet.
    if (incomingIsNewerOrEqual || !existing.lastSnapshotAt) {
        if (incoming.lastSnapshotId) out.lastSnapshotId = incoming.lastSnapshotId;
        if (incoming.lastSnapshotAt) out.lastSnapshotAt = incoming.lastSnapshotAt;
    }

    return out;
}

function isIncomingNewerOrEqual(
    existingSnapshotAt: string | undefined,
    incomingSnapshotAt: string | undefined,
): boolean {
    if (!existingSnapshotAt) return true;
    if (!incomingSnapshotAt) return true;

    return incomingSnapshotAt >= existingSnapshotAt;
}

function mergeCanonicalBranch(
    existing: Record<string, unknown> | undefined,
    incoming: Record<string, unknown>,
    incomingIsNewerOrEqual: boolean,
): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...(existing ?? {}) };

    for (const [key, value] of Object.entries(incoming)) {
        if (isMeaninglessValue(value)) {
            continue;
        }

        const existingValue = merged[key];

        if (Array.isArray(value)) {
            if (value.length === 0) {
                continue;
            }

            if (incomingIsNewerOrEqual || !hasMeaningfulValue(existingValue)) {
                merged[key] = value;
            }
            continue;
        }

        if (isPlainObject(value)) {
            merged[key] = mergeCanonicalBranch(
                isPlainObject(existingValue) ? (existingValue as Record<string, unknown>) : undefined,
                value,
                incomingIsNewerOrEqual,
            );
            continue;
        }

        if (incomingIsNewerOrEqual || !hasMeaningfulValue(existingValue)) {
            merged[key] = value;
        }
    }

    return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMeaninglessValue(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function hasMeaningfulValue(value: unknown): boolean {
    if (isMeaninglessValue(value)) return false;
    if (isPlainObject(value)) return Object.keys(value).length > 0;
    return true;
}
