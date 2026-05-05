/**
 * Comp-Collection Configuration
 *
 * Defines (a) which ProductType values trigger comp collection on
 * client-order placement, and (b) the per-product collection parameters
 * (radius, sold/active counts, sale window, geohash expansion).
 *
 * Currently a hardcoded const map. Tracked separately: move to a
 * tenant-scoped config doc in Cosmos so values can be tuned at runtime
 * without redeploys (see follow-up ticket).
 *
 * Values below are conservative starting points — tune after we have
 * real-world hit/miss data per product type.
 */

import { ProductType } from '../types/product-catalog.js';
import type { OrderCompCollectionConfig } from '../types/order-comparables.types.js';

/**
 * ProductTypes whose ClientOrder placement should trigger a comp-collection
 * run. Anything not in this set is a no-op for the listener.
 */
export const COMP_COLLECTION_TRIGGER_PRODUCT_TYPES: ReadonlySet<string> = new Set<string>([
  ProductType.BPO,
  ProductType.BPO_EXTERIOR,
  ProductType.BPO_INTERIOR,
  ProductType.DESKTOP_APPRAISAL,
  ProductType.DESKTOP_REVIEW,
  ProductType.DESK_REVIEW,
  ProductType.DVR,
  ProductType.HYBRID_APPRAISAL,
  ProductType.HYBRID,
  ProductType.EVALUATION,
]);

/**
 * Default config used when a triggering ProductType doesn't have an explicit
 * override. Conservative urban-friendly defaults.
 *
 * `selectionStrategy: 'tiered-ai'` means: whenever collection runs, the
 * tiered-AI strategy is invoked inline on the resulting candidate pool.
 * Per-product overrides below can opt out by setting `selectionStrategy: 'none'`.
 */
export const DEFAULT_COMP_COLLECTION_CONFIG: OrderCompCollectionConfig = {
  radiusMiles: 1,
  soldCount: 50,
  activeCount: 50,
  soldSaleWindowMonths: 12,
  geohashExpansion: 'ADAPTIVE',
  selectionStrategy: 'weighted', //'tiered-ai',
  numSold: 3,
  numActive: 3,
};

/**
 * Per-ProductType overrides. Anything not listed here falls back to
 * `DEFAULT_COMP_COLLECTION_CONFIG`. Add entries when a product needs
 * tighter / looser collection.
 */
export const COMP_COLLECTION_CONFIG_BY_PRODUCT_TYPE: Readonly<
  Record<string, OrderCompCollectionConfig>
> = {
  // Tighter radius for desktop products — they typically operate in
  // denser data environments and reviewers expect closer comps.
  // Both DESKTOP_APPRAISAL and DESKTOP_REVIEW inherit `selectionStrategy:
  // 'tiered-ai'` from DEFAULT_COMP_COLLECTION_CONFIG; this override only
  // tightens the collection radius and counts.
  [ProductType.DESKTOP_APPRAISAL]: {
    radiusMiles: 0.5,
    soldCount: 6,
    activeCount: 50,
    soldSaleWindowMonths: 9,
    geohashExpansion: 'ADAPTIVE',
    selectionStrategy: 'tiered-ai',
    numSold: 3,
    numActive: 3,
  },
  [ProductType.DESKTOP_REVIEW]: {
    radiusMiles: 0.5,
    soldCount: 50,
    activeCount: 50,
    soldSaleWindowMonths: 9,
    geohashExpansion: 'ADAPTIVE',
    selectionStrategy: 'tiered-ai',
    numSold: 3,
    numActive: 3,
  },
};

/**
 * MLS `listingStatus` value treated as ACTIVE in the ATTOM feed used by
 * this deployment. Most ATTOM/MLS feeds use `'A'` for ACTIVE; verify against
 * your data before changing.
 */
export const ACTIVE_LISTING_STATUS = 'A';

/**
 * Resolve the comp-collection config for a given ProductType.
 * Returns the per-type override if defined, otherwise the default.
 */
export function getCompCollectionConfig(
  productType: string,
): OrderCompCollectionConfig {
  return COMP_COLLECTION_CONFIG_BY_PRODUCT_TYPE[productType] ?? DEFAULT_COMP_COLLECTION_CONFIG;
}

/**
 * True iff placement of a ClientOrder with this ProductType should trigger
 * comp collection.
 */
export function shouldTriggerCompCollection(productType: string): boolean {
  return COMP_COLLECTION_TRIGGER_PRODUCT_TYPES.has(productType);
}
