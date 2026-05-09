/**
 * ClientOrder — what a client placed on an engagement.
 *
 * Hierarchy:
 *   Engagement
 *     └── EngagementProperty (many)
 *           └── ClientOrder (many; this file)
 *                 └── VendorOrder (many; see vendor-order.types.ts)
 *
 * A ClientOrder is the order the lender placed (e.g. "BPO" on a specific loan).
 * One or more VendorOrders fulfill it. Today decomposition is 1-to-1 (one
 * VendorOrder of the same productType); the model supports many.
 *
 * Cosmos container: `client-orders`
 * Partition key:    /tenantId
 * Discriminator:    type === 'client-order'
 *
 * Phase 0 introduces the type only. No service writes to this container yet.
 */

import type { ProductType } from './product-catalog.js';
import type {
  PropertyDetails,
  PropertyAddress,
  BorrowerInfo,
  LoanInfo,
  ContactInfo,
  OrderType,
  Priority,
} from './index.js';

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * ClientOrder lifecycle, derived (aggregated) from child VendorOrders.
 *
 *   PLACED               → newly created, no child VendorOrder has started work
 *   IN_FULFILLMENT       → ≥1 VendorOrder is active (ASSIGNED or later) and not all are DELIVERED
 *   PARTIALLY_DELIVERED  → some — but not all — child VendorOrders are DELIVERED
 *   DELIVERED            → all child VendorOrders are DELIVERED (no further client action expected)
 *   COMPLETED            → all child VendorOrders are COMPLETED
 *   ON_HOLD              → administratively paused
 *   CANCELLED            → cancelled before completion
 *
 * Aggregation rules live in client-order-status-aggregator.service.ts (Phase 3).
 */
export enum ClientOrderStatus {
  PLACED              = 'PLACED',
  IN_FULFILLMENT      = 'IN_FULFILLMENT',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  DELIVERED           = 'DELIVERED',
  COMPLETED           = 'COMPLETED',
  ON_HOLD             = 'ON_HOLD',
  CANCELLED           = 'CANCELLED',
}

// ─── ClientOrder ─────────────────────────────────────────────────────────────

/**
 * Cosmos document type discriminator. The same `client-orders` container could
 * later carry related document types; keep `type` populated on every write.
 */
export const CLIENT_ORDER_DOC_TYPE = 'client-order' as const;

export interface ClientOrder {
  // ── Identity ─────────────────────────────────────────────────────────────
  /** Cosmos document id (clientOrderId). */
  id: string;
  /** Partition key. */
  tenantId: string;
  /** Discriminator — always 'client-order' for ClientOrder docs. */
  type: typeof CLIENT_ORDER_DOC_TYPE;
  /** Human-readable identifier (e.g. CO-2026-0001). */
  clientOrderNumber: string;

  // ── Engagement linkage (REQUIRED) ────────────────────────────────────────
  /** FK to the parent Engagement. */
  engagementId: string;
  /** FK to the specific EngagementProperty within the engagement. */
  engagementPropertyId: string;
  /** FK to the client (lender/AMC) that placed the order. */
  clientId: string;

  // ── What was ordered ─────────────────────────────────────────────────────
  productType: ProductType;
  /** Loan purpose (purchase / refinance / equity_line / construction / other). */
  orderType?: OrderType;
  /**
   * FK to the canonical PropertyRecord.
   *
   * Optional today during construction: callers may supply propertyDetails
   * and let the service resolve propertyId asynchronously. A follow-up
   * refactor will require propertyId on every placement (resolve at call
   * site or controller boundary) so this can flip to required.
   */
  propertyId?: string;
  /** Display cache of the property until propertyId joins are universal. */
  propertyDetails: PropertyDetails;
  /**
   * Structured property address (street, city, state, zip, county, etc.).
   * Carried alongside `propertyDetails` because legacy /api/orders payloads
   * supplied them as separate sections; new placements may leave this
   * undefined and rely on `propertyId` → PropertyRecord.
   */
  propertyAddress?: PropertyAddress;
  /** Free-form lender instructions for this order. */
  instructions?: string;
  /**
   * ROUTINE | EXPEDITED | RUSH | EMERGENCY (engagement priority value space)
   * — stringly-typed to avoid a circular import. The vendor-side urgency on
   * VendorOrder uses a different value space (`Priority` from index.ts).
   */
  priority?: string;
  /** Lender-facing due date (ISO date). */
  dueDate?: string;
  /** True when the lender requested rush turnaround. */
  rushOrder?: boolean;

  // ── Lender-supplied parties (Phase 3 — NEW HOME) ─────────────────────────
  // These fields used to live on Order/VendorOrder. They've been relocated
  // here because they describe the lender's submission of the order, not
  // the vendor's fulfillment of it. VendorOrder readers that need this
  // context join through `clientOrderId`.
  /** The borrower(s) on the loan. */
  borrowerInformation?: BorrowerInfo;
  /** The loan being underwritten — amount, type, purpose, ratios. */
  loanInformation?: LoanInfo;
  /** Lender point of contact for this order. */
  contactInformation?: ContactInfo;
  /** Vendor-priority signal carried over from the lender's request, if any. */
  vendorPriority?: Priority;
  /** Free-form notes the lender wants attached to the order. */
  specialInstructions?: string;
  /** Free-form tags applied at intake (kept on ClientOrder for reporting). */
  tags?: string[];
  /** Caller-supplied metadata bag (kept on ClientOrder, not VendorOrder). */
  metadata?: Record<string, unknown>;

  // ── Money in (client) ────────────────────────────────────────────────────
  /** What the lender is charged for this order. */
  clientFee?: number;
  /** UNPAID | PAID | PARTIAL — populated by billing flow. */
  paymentStatus?: string;
  /** Link to the QuickBooks invoice once issued. */
  quickbooksInvoiceId?: string;

  // ── State ────────────────────────────────────────────────────────────────
  clientOrderStatus: ClientOrderStatus;
  /** ISO timestamp when the order was first placed. */
  placedAt: string;
  /** ISO timestamp when all VendorOrders reached DELIVERED. */
  deliveredAt?: string;
  /** ISO timestamp when all VendorOrders reached COMPLETED. */
  completedAt?: string;
  /** ISO timestamp when status moved to CANCELLED. */
  cancelledAt?: string;

  // ── Children ─────────────────────────────────────────────────────────────
  /** VendorOrder IDs that fulfill this ClientOrder. */
  vendorOrderIds: string[];
  /** Final deliverable document ids surfaced to the lender. */
  finalDeliverableIds?: string[];

  // ── Audit ────────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Cosmos container name for ClientOrder documents.
 * Provisioned by infrastructure/modules/cosmos-client-orders-container.bicep.
 */
export const CLIENT_ORDERS_CONTAINER = 'client-orders' as const;
