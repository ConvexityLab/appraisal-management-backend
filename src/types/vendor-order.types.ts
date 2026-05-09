/**
 * VendorOrder — vendor-dispatched fulfillment work for a ClientOrder.
 *
 * Hierarchy:
 *   Engagement
 *     └── EngagementProperty
 *           └── ClientOrder (see client-order.types.ts)
 *                 └── VendorOrder (this file; many)
 *
 * One ClientOrder is decomposed into one or more VendorOrders by
 * OrderDecompositionService (Phase 1). Today the decomposition is 1-to-1
 * (one VendorOrder of the same productType); the model supports many.
 *
 * Cosmos container: `orders` (existing — repurposed in Phase 4)
 * Partition key:    /tenantId
 * Discriminator:    type === 'vendor-order'  (Phase 4 migration rewrites
 *                   existing rows from `type: 'order'` → `type: 'vendor-order'`)
 *
 * Phase 0 introduces the type only. Existing Order remains the
 * authoritative shape for runtime operations until Phase 1 + Phase 4.
 *
 * Why a thin wrapper instead of a full re-shape now?
 *   The existing Order already carries every vendor-side field we
 *   need. The split is conceptual: this file marks which fields *belong* to
 *   the vendor side and adds the new linkage fields (clientOrderId,
 *   denormalized ancestry, vendorWorkType). Later phases will progressively
 *   tighten the type (rename `status` → `vendorOrderStatus`, separate
 *   client-side fields out, etc.).
 */

import type { Order } from './index.js';
import type { OrderStatus } from './order-status.js';
import type { ProductType } from './product-catalog.js';
import type { InspectionVendorData } from './inspection-vendor.types.js';

// ─── Status (alias of existing OrderStatus) ──────────────────────────────────

/**
 * Vendor-side status. Today this is the same enum as OrderStatus — Phase 4
 * will rename the field on documents (`status` → `vendorOrderStatus`) but the
 * value space is unchanged.
 */
export type VendorOrderStatus = OrderStatus;

// ─── Vendor work type ────────────────────────────────────────────────────────

/**
 * What kind of work this VendorOrder represents.
 *
 * Reuses ProductType today (1-to-1 with the ClientOrder's productType).
 * Reserved as a separate alias so future multi-step decomposition can
 * introduce values like INSPECTION / BPO_BROKER without churning every
 * caller of ProductType.
 */
export type VendorWorkType = ProductType;

// ─── Discriminator + container ───────────────────────────────────────────────

/** Cosmos document type discriminator (Phase 4: replaces legacy `'order'`). */
export const VENDOR_ORDER_DOC_TYPE = 'vendor-order' as const;

/**
 * @deprecated Pre-rewrite legacy discriminator value. Retained only as a
 * compile-time constant so existing code that compares `resource.type !==
 * LEGACY_VENDOR_ORDER_DOC_TYPE` continues to typecheck. New writes use
 * `VENDOR_ORDER_DOC_TYPE`; reads (`VENDOR_ORDER_TYPE_PREDICATE`) no longer
 * match the legacy value. Pure-dev cleanup will retire this constant once
 * every comparison site has been updated.
 */
export const LEGACY_VENDOR_ORDER_DOC_TYPE = 'order' as const;

/** Cosmos container name for VendorOrder documents. */
export const VENDOR_ORDERS_CONTAINER = 'orders' as const;

/**
 * SQL predicate fragment that matches the VendorOrder discriminator.
 *
 * Pure-dev cleanup (slice 8j retirement): legacy `type: 'order'` rows have
 * been retired with the staging re-seed; only `VENDOR_ORDER_DOC_TYPE` is
 * written and read going forward.
 *
 * Use as: `WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.id = @id`
 */
export const VENDOR_ORDER_TYPE_PREDICATE =
    `c.type = '${VENDOR_ORDER_DOC_TYPE}'` as const;

// ─── Linkage fields (NEW, added by Phase 1 / Phase 4 migration) ─────────────

/**
 * Linkage fields VendorOrder docs gain on top of the existing Order
 * shape. Phase 1 starts writing these on every newly-created VendorOrder;
 * Phase 4 backfills them on historical rows.
 *
 * - clientOrderId         FK to the parent ClientOrder (REQUIRED)
 * - denormalized ancestry: engagementId / engagementPropertyId / clientId /
 *                          productType / propertyId — set once at client-order
 *                          time, never updated independently of the ClientOrder.
 * - vendorWorkType        what kind of work this VendorOrder represents
 *                          (= productType today).
 *
 * `engagementId`, `engagementPropertyId`, and `propertyId` already exist on
 * Order as optional. They become REQUIRED on VendorOrder.
 */
export interface VendorOrderLinkage {
  /** Discriminator: always `'vendor-order'` (legacy `'order'` retired in slice 8j). */
  type: typeof VENDOR_ORDER_DOC_TYPE;
  /** Partition key — REQUIRED on VendorOrder (optional on Order for legacy reasons). */
  tenantId: string;
  clientOrderId: string;
  engagementId: string;
  engagementPropertyId: string;
  clientId: string;
  productType: ProductType;
  propertyId: string;
  vendorWorkType: VendorWorkType;
  /**
   * Populated once an inspection vendor order is placed via InspectionVendorService.
   * Tracks all vendor-side state, external IDs, and blob storage paths for artifacts.
   */
  inspectionVendorData?: InspectionVendorData;
}

// ─── VendorOrder ─────────────────────────────────────────────────────────────

/**
 * VendorOrder is the Order fields PLUS the linkage fields above.
 *
 * Phases 1–3 progressively tighten this shape; Phase 4 enforces it on every
 * row in the `orders` container. Until then, treat Order as the
 * runtime authority and `VendorOrder` as the target shape.
 */
export type VendorOrder = Order & VendorOrderLinkage;
