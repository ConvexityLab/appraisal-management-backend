/**
 * Comp-Selection Strategy Interface
 *
 * Defines the stable contract every comp-selection strategy must implement.
 * Strategies receive an already-collected pool of `CollectedCompCandidate`s
 * (produced by `OrderCompCollectionService`) plus the subject property, and
 * return a typed selection of "best" sold + active comps.
 *
 * The interface is intentionally narrow so swapping strategies (rule-based,
 * weighted, AI-driven, ML-driven, ...) is a one-line config change at the
 * call site. New strategies are added by:
 *   1. implementing this interface
 *   2. registering an instance in `CompSelectionStrategyRegistry`
 *   3. setting `selectionStrategy: '<name>'` in `comp-collection-config.ts`
 *
 * @see CompSelectionStrategyRegistry (./registry.ts)
 */

import type { PropertyRecord } from '@l1/shared-types';
import type { CollectedCompCandidate } from '../../types/order-comparables.types.js';

/**
 * One selected comp returned by a strategy. Address fields are denormalized
 * snapshots from `CanonicalAddress` (matching field names) so consumers don't
 * have to re-join `property-records` for display, and so historical selections
 * remain readable if the underlying record is later updated.
 */
export interface SelectedComp {
  /** FK back to the candidate's `PropertyRecord.id`. */
  propertyId: string;
  /** Snapshot of `CanonicalAddress.street` at selection time. */
  street: string;
  /** Snapshot of `CanonicalAddress.city`. */
  city: string;
  /** Snapshot of `CanonicalAddress.state`. */
  state: string;
  /** Snapshot of `CanonicalAddress.zip`. */
  zip: string;
  /** Tier 1–5 from `assignCompTier()`, or undefined if the strategy doesn't tier. */
  tier?: number;
  /**
   * Selection flag: `S1..Sn` for sold comps, `L1..Ln` for active listings.
   * 1-based ordinal in selection order.
   */
  selectionFlag: string;
  /** Optional strategy-specific score (e.g. weighted composite score). */
  score?: number;
  /** Optional natural-language explanation (e.g. AI reasoning). */
  reasoning?: string;
  /** Origin of the selection decision. */
  source: 'ai' | 'rule' | 'manual';
}

/**
 * Standard input handed to every strategy. Strategies must NOT fetch
 * candidates themselves — collection is upstream.
 */
export interface CompSelectionInput {
  /** Canonical ClientOrder.id (partition key on order-comparables). */
  orderId: string;
  /** Human-readable client order number (currently aliased to id; designed to diverge). */
  clientOrderNumber: string;
  /** Tenant scope (passthrough for persistence). */
  tenantId: string;
  /** Subject property — full canonical record. */
  subject: PropertyRecord;
  /** Pre-collected candidate pool from OrderCompCollectionService. */
  candidates: CollectedCompCandidate[];
  /** How many sold + active comps the caller wants. */
  requested: { sold: number; active: number };
  /** Order's product type (BPO, DESKTOP_APPRAISAL, ...). */
  productType: string;
  /** Optional correlation id for log tracing. */
  correlationId?: string;
}

/**
 * Standard output every strategy returns. Persistence is the caller's
 * responsibility — strategies are pure compute.
 */
export interface CompSelectionResult {
  /** Strategy that produced this result (e.g. 'tiered-ai', 'weighted'). */
  strategyName: string;
  /** Prompt template version, when the strategy uses one. */
  promptVersion?: string;
  /** Echoed orderId so the result is self-describing. */
  orderId: string;
  /** Echoed clientOrderNumber. */
  clientOrderNumber: string;
  /** Selected sold comps in flag order (S1, S2, ...). */
  selectedSold: SelectedComp[];
  /** Selected active comps in flag order (L1, L2, ...). */
  selectedActive: SelectedComp[];
  /** Populated when the strategy could not fill the requested counts. */
  shortfall?: { sold?: number; active?: number };
  /** Strategy-specific diagnostics (token counts, tier breakdowns, ...). */
  diagnostics?: Record<string, unknown>;
}

/**
 * The contract every comp-selection strategy implements.
 */
export interface ICompSelectionStrategy {
  /** Stable, unique identifier used by the registry and config. */
  readonly name: string;
  /** Pure compute — no persistence side effects. */
  select(input: CompSelectionInput): Promise<CompSelectionResult>;
}
