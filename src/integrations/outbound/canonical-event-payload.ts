/**
 * Outbound canonical event-payload helper
 *
 * Centralises how AMP attaches canonical-shaped data to outbound events
 * (Service Bus topics: order-events, vendor-events, quality-control-events,
 * + the vendor-event-outbox direction='outbound' path). Consumers that have
 * migrated to canonical can read `event.canonical.{subject|loan|ratios}`;
 * legacy consumers continue to read the existing event fields. This is
 * ADDITIVE — no existing event field is removed by this slice.
 *
 * Why a single helper:
 *   - One place defines the outbound canonical shape, so all topics emit
 *     the same projection.
 *   - When canonical-schema evolves (new branch, renamed field), only this
 *     module changes, not every publish-X method scattered across services.
 *   - Stable serialisation (sorted keys at top level) means downstream
 *     event-replay / hash-key comparisons stay deterministic.
 *
 * Posture: pure data projection — no I/O, no validation rejection. Garbage
 * in → garbage out is acceptable because the upstream snapshot has already
 * validated canonical at ingress (slice 6); this helper just selects the
 * canonical view from inputs the caller already has.
 */

import { mapAppraisalOrderToCanonical } from '../../mappers/appraisal-order.mapper.js';
import type {
    CanonicalLoan,
    CanonicalLoanRatios,
    CanonicalReportDocument,
    CanonicalSubject,
} from '../../types/canonical-schema.js';
import type { OrderContext } from '../../services/order-context-loader.service.js';

/**
 * Outbound canonical block. Each branch is independently optional so callers
 * can attach only what's known at publish time.
 *
 * `eventCanonicalVersion` lets downstream consumers gate on shape compat
 * — increment when the projection's wire shape changes incompatibly.
 */
export interface OutboundCanonicalPayload {
    eventCanonicalVersion: '1.0';
    subject?: Partial<CanonicalSubject>;
    loan?: CanonicalLoan;
    ratios?: CanonicalLoanRatios;
    /** Optional snapshotId so consumers can fetch the full canonical from canonical-snapshots. */
    snapshotId?: string;
}

/**
 * Build an outbound canonical payload from an OrderContext.
 *
 * Phase 7 of the Order-relocation refactor: this helper now takes an
 * OrderContext (VendorOrder + parent ClientOrder joined) so the
 * projection sees lender-side fields from their proper home.
 *
 * Returns null when the order has no canonical-relevant data (rare —
 * orders almost always have a property address).
 *
 * Callers SHOULD prefer the snapshot-derived payload (when a snapshot
 * exists) over this order-based one, because the snapshot reflects all
 * sources merged — extraction, enrichment, intake, tape. This helper
 * exists for the pre-snapshot publish path (e.g. ORDER_CREATED, where
 * extraction hasn't run yet).
 */
export function buildCanonicalPayloadFromOrder(
    ctx: OrderContext | null | undefined,
    snapshotId?: string,
): OutboundCanonicalPayload | null {
    const projected = mapAppraisalOrderToCanonical(ctx);
    if (!projected) return null;

    const out: OutboundCanonicalPayload = { eventCanonicalVersion: '1.0' };
    if (projected.subject) out.subject = projected.subject;
    if (projected.loan) out.loan = projected.loan;
    if (projected.ratios) out.ratios = projected.ratios;
    if (snapshotId) out.snapshotId = snapshotId;

    return out;
}

/**
 * Build an outbound canonical payload from a snapshot's normalizedData.canonical.
 *
 * The snapshot's canonical fragment IS already in the canonical shape (slice 1
 * onwards), so we just pick the branches we want to publish. Defensive against
 * snapshots written before canonical fields existed.
 */
export function buildCanonicalPayloadFromSnapshot(
    canonical: Partial<CanonicalReportDocument> | null | undefined,
    snapshotId?: string,
): OutboundCanonicalPayload | null {
    if (!canonical) return null;

    const out: OutboundCanonicalPayload = { eventCanonicalVersion: '1.0' };
    if (canonical.subject) out.subject = canonical.subject;
    if (canonical.loan) out.loan = canonical.loan;
    if (canonical.ratios) out.ratios = canonical.ratios;
    if (snapshotId) out.snapshotId = snapshotId;

    // Empty payload (just the version) — caller doesn't need to publish.
    const hasContent =
        out.subject != null || out.loan != null || out.ratios != null || out.snapshotId != null;
    return hasContent ? out : null;
}
