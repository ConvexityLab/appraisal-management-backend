/**
 * Value-Estimator Interface
 *
 * Same swap-friendly pattern as `ICompSelectionStrategy` — narrow interface
 * + registry — so we can replace the comp-based estimator with a regression
 * model, AVM cascade re-use, or AI-driven approach without touching the
 * pipeline.
 */

import type { PropertyRecord } from '../../types/property-record.types.js';
import type { SelectedComp } from '../comp-selection/strategy.js';

/**
 * Result of a value estimate. All money values are USD; pricePerSqft is USD/sqft.
 *
 * `lowerBound` / `upperBound` are present when there is enough data; they are
 * not synthetic widening of the point estimate.
 */
export interface ValueEstimate {
  /** Estimator that produced this result (e.g. 'comp-based'). */
  estimatorName: string;
  /** Point estimate, USD. */
  estimatedValue: number;
  /** Lower bound, USD. */
  lowerBound?: number;
  /** Upper bound, USD. */
  upperBound?: number;
  /** Mean confidence score across input comps (0–1 if sources used 0–1, else 0–100). */
  confidence?: number;
  /** Per-comp price-per-sqft used in the calculation, in input order. */
  perCompPricePerSqft: number[];
  /** ISO timestamp the estimate was computed. */
  computedAt: string;
}

export interface IValueEstimator {
  /** Stable identifier used by the registry. */
  readonly name: string;
  /** Compute an estimate for the subject from selected sold comps. */
  compute(subject: PropertyRecord, soldComps: SelectedCompWithPropertyRecord[]): Promise<ValueEstimate>;
}

/**
 * The comp-based estimator needs more than just the `SelectedComp` flag — it
 * needs each comp's GLA + AVM block. We pass them as a tuple to keep the
 * `SelectedComp` shape minimal and the dependency direction clean.
 */
export interface SelectedCompWithPropertyRecord {
  selected: SelectedComp;
  propertyRecord: PropertyRecord;
}
