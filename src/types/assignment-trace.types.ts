/**
 * Assignment Trace — types
 *
 * Per-assignment evaluation record persisted on every triggerVendorAssignment
 * so operators can answer "why was vendor X picked" or "why didn't vendor Y
 * get considered" from the order-detail page without digging through logs.
 *
 * Phase 5 T37 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.6. Stored in Cosmos
 * container `assignment-traces`, partitioned by `/tenantId`.
 *
 * The matchExplanations[] field is the same MatchExplanation already attached
 * to RankedVendorEntry (Phase 1 F9) — we re-persist it in the trace doc so
 * trace queries don't have to JOIN against the order. Cheap denormalization;
 * traces are write-once, never updated.
 */

import type { MatchExplanation, DeniedVendorEntry } from './vendor-marketplace.types.js';

export interface AssignmentTraceDocument {
  id: string;
  type: 'assignment-trace';
  tenantId: string;
  orderId: string;

  /** Anchor for ordering / dedupe across re-triggers. ISO timestamp. */
  initiatedAt: string;

  /** Which rules backend produced this trace. */
  rulesProviderName: 'homegrown' | 'mop' | 'mop-with-fallback' | string;

  /**
   * Snapshot of the inputs that drove the eval. Vendor data may change after
   * the decision; this captures what mattered at decision time.
   */
  matchRequest: {
    propertyAddress: string;
    propertyType: string;
    productId?: string;
    requiredCapabilities?: string[];
    dueDate: string;
    urgency?: 'STANDARD' | 'RUSH' | 'SUPER_RUSH';
    budget?: number;
  };

  /**
   * Vendors the engine considered and ranked, in the order the orchestrator
   * tried them. Each carries the full MatchExplanation (score breakdown,
   * applied rule IDs, deny reasons, score adjustment, weightsVersion).
   */
  rankedVendors: Array<{
    vendorId: string;
    vendorName: string;
    score: number;
    staffType?: 'internal' | 'external';
    staffRole?: string;
    explanation?: MatchExplanation;
  }>;

  /** Vendors the rules engine filtered out before ranking, with reasons. */
  deniedVendors: DeniedVendorEntry[];

  /**
   * Final disposition the orchestrator settled on at trace-write time.
   *   pending_bid       — bid sent to top vendor; awaiting response
   *   broadcast         — bids sent to multiple vendors (broadcast mode)
   *   assigned_internal — internal staff member assigned without bid loop
   *   escalated         — no eligible vendor found OR all timed out → human queue
   *   exhausted         — same as escalated, written when ranked list is exhausted
   */
  outcome: 'pending_bid' | 'broadcast' | 'assigned_internal' | 'escalated' | 'exhausted';
  /** Set when outcome is assigned_internal OR pending_bid (the candidate currently being attempted). */
  selectedVendorId: string | null;

  /** Wall-clock latency from triggerVendorAssignment start to ranking complete. */
  rankingLatencyMs: number;
}

/** Light projection for the FE timeline (rendering thousands of entries). */
export interface AssignmentTraceSummary {
  id: string;
  orderId: string;
  initiatedAt: string;
  outcome: AssignmentTraceDocument['outcome'];
  selectedVendorId: string | null;
  rankedCount: number;
  deniedCount: number;
  rulesProviderName: string;
  rankingLatencyMs: number;
}
