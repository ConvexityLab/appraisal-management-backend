/**
 * Engagement Domain Types
 *
 * A LenderEngagement is the aggregate root for all valuation work on one or
 * more PROPERTIES. It represents what a client (lender/AMC) hired us to
 * produce.
 *
 * Hierarchy (corrected per design conversation 2026-05-05):
 *   LenderEngagement (1)
 *     └── EngagementProperty (1..1000) — one per physical property in scope
 *           ├── propertyId → PropertyRecord (load-bearing FK)
 *           ├── loanReferences[]                  (informational metadata —
 *           │                                      a property may carry multiple
 *           │                                      loans: first lien + HELOC + refi.
 *           │                                      Schema lands in slice 8d; until
 *           │                                      then top-level loanNumber etc.
 *           │                                      remain on this entity.)
 *           └── EngagementClientOrder (1..N)      — what the client ordered for this property
 *                 └── vendorOrderIds (0..N)       — what we ordered from vendors
 *
 * Legacy naming retained for back-compat:
 *   `EngagementLoan` is now a deprecated type alias of `EngagementProperty`.
 *   `Engagement.loans` is a deprecated read-alias of `Engagement.properties`.
 *   `EngagementLoanStatus` is a deprecated enum alias of `EngagementPropertyStatus`.
 *   These will be removed in slice 8k once all consumers have migrated.
 *
 * Lifecycles:
 *   Engagement:         RECEIVED → ACCEPTED → IN_PROGRESS → QC → DELIVERED
 *   EngagementProperty: PENDING → IN_PROGRESS → QC → DELIVERED
 *   VendorOrder:        NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → DELIVERED
 */

import { OrderPriority, PropertyDetails } from './order-management.js';
import type { ProductType } from './product-catalog.js';
import type { QueryFilter } from './authorization.types.js';

// ── Re-exports for consumers who only import from engagement.types ────────────
export { OrderPriority } from './order-management.js';
export { ProductType } from './product-catalog.js';
// Back-compat alias: legacy name retained for tests/seed/legacy callers.
export { ProductType as EngagementProductType } from './product-catalog.js';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Whether the engagement covers a single property or multiple (portfolio tape).
 * Auto-set by the service: SINGLE when properties.length === 1, PORTFOLIO otherwise.
 */
export enum EngagementType {
  SINGLE    = 'SINGLE',
  PORTFOLIO = 'PORTFOLIO',
}

/**
 * The overall lifecycle of a LenderEngagement (engagement-level).
 * Distinct from VendorOrderStatus which tracks the vendor-side fulfillment.
 */
export enum EngagementStatus {
  RECEIVED    = 'RECEIVED',    // Client submitted; awaiting our acceptance
  ACCEPTED    = 'ACCEPTED',    // We have accepted the engagement
  IN_PROGRESS = 'IN_PROGRESS', // At least one vendor order is underway
  QC          = 'QC',          // Report is under internal quality control
  REVISION    = 'REVISION',    // Revision requested (by client or QC)
  DELIVERED   = 'DELIVERED',   // Final deliverable sent to lender
  CANCELLED   = 'CANCELLED',
  ON_HOLD     = 'ON_HOLD',
}

/**
 * Lifecycle for a single EngagementProperty within a portfolio engagement.
 * Independent of the parent EngagementStatus.
 */
export enum EngagementPropertyStatus {
  PENDING     = 'PENDING',      // Property received; work not yet begun
  IN_PROGRESS = 'IN_PROGRESS',  // Active vendor orders underway
  QC          = 'QC',           // Report under internal review
  DELIVERED   = 'DELIVERED',    // Deliverable sent to lender
  CANCELLED   = 'CANCELLED',    // Property removed from engagement
}

/**
 * @deprecated Use `EngagementPropertyStatus`. The old name was
 * loan-anchored; the entity is property-anchored. Will be removed in slice 8k.
 */
export const EngagementLoanStatus = EngagementPropertyStatus;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type EngagementLoanStatus = EngagementPropertyStatus;

/**
 * The status of a single client order within an engagement property.
 */
export enum EngagementClientOrderStatus {
  PENDING     = 'PENDING',      // Not yet assigned to a vendor
  ASSIGNED    = 'ASSIGNED',     // Vendor order created
  IN_PROGRESS = 'IN_PROGRESS',
  DELIVERED   = 'DELIVERED',    // Vendor delivered; pending QC/report
  COMPLETED   = 'COMPLETED',    // Report delivered to lender
  CANCELLED   = 'CANCELLED',
}

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Org-level client context — who hired us.
 * Contains only lender/AMC-level fields. All property-level fields live on EngagementProperty.
 */
export interface EngagementClient {
  clientId: string;
  subClientId?: string;
  clientName: string;
  loanOfficer?: string | undefined;
  loanOfficerEmail?: string | undefined;
  loanOfficerPhone?: string | undefined;
}

/**
 * Loan-level reference metadata attached to a property.
 *
 * One physical property may carry multiple loans simultaneously: a first-lien
 * mortgage + a HELOC + a refi-in-flight. None of these is the parent of any
 * order — they exist purely so that when a client says "this is about loan
 * 12345" we can resolve the conversation to the right property.
 *
 * Workflow does NOT hang off LoanReference. Orders, products, third-party
 * data, enrichment, canonical accumulation — all anchor on the property
 * (EngagementProperty.propertyId → PropertyRecord). Loans are pure metadata.
 *
 * Field set confirmed in design conversation 2026-05-05.
 */
export interface LoanReference {
  /** Primary identifier — the lender's loan number. Required. */
  loanNumber: string;
  /** Original principal balance, USD. */
  loanAmount?: number;
  /** Free-form loan type from the client (FHA / Conventional / VA / Jumbo / NonQM / etc.). */
  loanType?: string;
  /** Free-form loan purpose (Purchase / Refinance / Construction / etc.). */
  loanPurpose?: string;
  /** Lien position. Allows multiple liens on the same property. */
  lienPosition?: 'First' | 'Second' | 'HELOC' | 'Other';
  /** Originator / lender of record at note signing. */
  originator?: string;
  /** ISO date the note was signed. */
  noteDate?: string;
  /** FHA case number, when applicable (FHA-specific). */
  fhaCase?: string;
}

/**
 * A single client order placed by the lender for a specific property — one
 * deliverable product the client wants from us. One EngagementProperty may have
 * multiple client orders (e.g., Full Appraisal + AVM).
 */
export interface EngagementClientOrder {
  /** ID scoped within the engagement document */
  id: string;
  productType: ProductType;
  status: EngagementClientOrderStatus;
  /** Instructions specific to this client order from the lender */
  instructions?: string | undefined;
  /** What we charge the lender for this client order */
  fee?: number | undefined;
  /** Lender-facing due date for this client order */
  dueDate?: string | undefined; // ISO date
  /**
   * @deprecated Eventually-consistent denormalized cache. NOT a source of truth.
   *
   * Source of truth for "which VendorOrders fulfill this client order" is the
   * `orders` container, queried by engagementId (+ optionally engagementLoanId
   * / clientOrderId). The engagement-primacy guard enforces those linkage
   * fields on every VendorOrder write.
   *
   * This embedded array can drift on partial-failure writes (see
   * client-order.service.ts: "placeClientOrder is NOT atomic"). All authoritative
   * backend reads (removeLoan guard, getDocuments, getCommunications,
   * engagement-lifecycle auto-close) now query the orders container directly.
   * Reconciliation of historical drift is performed by
   * src/scripts/backfill-engagement-vendor-order-ids.ts.
   *
   * The field is retained on the schema for backwards compat until every
   * remaining writer (frontend CreateVendorOrderDialog.linkOrder, backend
   * addVendorOrderToClientOrder) has been removed.
   */
  vendorOrderIds: string[];
}

/**
 * A single physical property within an engagement.
 *
 * For SINGLE engagements there is exactly one. For PORTFOLIO engagements
 * there are 1..1000. Embedded inside the Engagement document
 * (loansStoredExternally = false).
 *
 * Property is the load-bearing entity — orders, products, third-party data,
 * enrichment, canonical accumulation, comps history all hang off the property.
 *
 * Loans hang off the property as `loanReferences: LoanReference[]` —
 * reference-only metadata so that when a client mentions "loan 12345" we
 * can resolve to the right property. Multiple loans per property are
 * supported: first lien + HELOC + refi-in-flight all coexist.
 *
 * Top-level `loanNumber` / `loanType` / `fhaCase` fields are RETAINED but
 * deprecated (slice 8k removes them). The service layer keeps them in sync
 * with `loanReferences[0]` (the primary loan) during the transition so
 * legacy readers continue to work.
 */
export interface EngagementProperty {
  /** ID generated by the service: prop-<ts>-<rand> (was loan-<ts>-<rand>) */
  id: string;

  // ── Property identity (load-bearing) ────────────────────────────────────
  /** FK → PropertyRecord.id — the canonical property record for this collateral. */
  propertyId?: string;
  /**
   * @deprecated Use propertyId to reference the canonical PropertyRecord instead.
   * Retained as a display cache during Phase R0–R2 migration.
   */
  property: PropertyDetails;

  // ── Loan references (canonical home for loan metadata since slice 8d) ───
  /**
   * All loans known to be against this property. The first entry is treated as
   * the primary loan for back-compat with the legacy top-level fields.
   * Optional during transition — properties created before slice 8d may not
   * carry it. Service layer back-fills from the deprecated top-level fields.
   */
  loanReferences?: LoanReference[];

  // ── Loan reference metadata (DEPRECATED — slice 8k removes these) ───────
  /** @deprecated Use `loanReferences[0].loanNumber`. Kept in sync by service layer. */
  loanNumber: string;
  /** @deprecated Use `loanReferences[0].loanType`. Kept in sync by service layer. */
  loanType?: string | undefined;
  /** @deprecated Use `loanReferences[0].fhaCase`. Kept in sync by service layer. */
  fhaCase?: string | undefined;

  // ── Borrower (property-level — same person across multiple loans on same prop) ─
  borrowerName: string;
  borrowerEmail?: string | undefined;
  loanOfficer?: string | undefined;
  loanOfficerEmail?: string | undefined;
  loanOfficerPhone?: string | undefined;

  // ── Lifecycle ───────────────────────────────────────────────────────────
  status: EngagementPropertyStatus;

  // ── Client orders for this property (1..N) ──────────────────────────────
  clientOrders: EngagementClientOrder[];
}

/**
 * @deprecated Use `EngagementProperty`. The old name was loan-anchored; the
 * entity is property-anchored. Will be removed in slice 8k.
 */
export type EngagementLoan = EngagementProperty;

/**
 * Engagement — the aggregate root for all valuation work.
 *
 * Cosmos container: "engagements"
 * Partition key:    /tenantId
 *
 * Storage: properties are embedded in this document while properties.length ≤ 1000.
 * loansStoredExternally is reserved for a future external container path (not yet built).
 */
export interface Engagement {
  id: string;
  /** Human-readable reference: ENG-2026-001234 */
  engagementNumber: string;
  tenantId: string;

  // ── Type ────────────────────────────────────────────────────────────────
  /** SINGLE when properties.length === 1; PORTFOLIO when > 1. Set by service. */
  engagementType: EngagementType;
  /** Always false until external loan container path is implemented. */
  loansStoredExternally: boolean;

  // ── Who ordered it ──────────────────────────────────────────────────────
  /** Org-level client. Property-level fields live on each EngagementProperty. */
  client: EngagementClient;

  // ── Properties ──────────────────────────────────────────────────────────
  /** 1..1000 properties, each with its own client orders. */
  properties: EngagementProperty[];

  // ── Lifecycle ───────────────────────────────────────────────────────────
  status: EngagementStatus;
  priority: OrderPriority;

  // ── Dates ───────────────────────────────────────────────────────────────
  /** When we received the engagement from the lender */
  receivedAt: string;       // ISO datetime
  /** Lender's deadline for the final deliverable */
  clientDueDate?: string;   // ISO date
  /** Our internal working deadline */
  internalDueDate?: string; // ISO date
  /** When the engagement was closed (delivered or cancelled) */
  closedAt?: string;        // ISO datetime

  // ── Financials ──────────────────────────────────────────────────────────
  /** Sum of all EngagementClientOrder fees across all properties — what we charge the lender */
  totalEngagementFee?: number;
  /** Links this Engagement to the QuickBooks Bill (Accounts Payable) generated for our vendors */
  quickbooksBillId?: string;
  // ── Instructions ────────────────────────────────────────────────────────
  accessInstructions?: string;
  specialInstructions?: string;
  engagementInstructions?: string;

  // ── Audit ───────────────────────────────────────────────────────────────
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

// =============================================================================
// REQUEST / RESPONSE SHAPES
// =============================================================================

/** Shape for each property entry when creating an engagement. */
export type CreateEngagementPropertyRequest = Omit<EngagementProperty, 'id' | 'status' | 'clientOrders'> & {
  clientOrders: Omit<EngagementClientOrder, 'id' | 'status' | 'vendorOrderIds'>[];
};

/**
 * @deprecated Use `CreateEngagementPropertyRequest`. Retained for back-compat
 * during slice 8c migration.
 */
export type CreateEngagementLoanRequest = CreateEngagementPropertyRequest;

/** Patch shape for updating scalar fields on an existing property (not clientOrders, not status). */
export type UpdateEngagementPropertyRequest = Partial<
  Omit<EngagementProperty, 'id' | 'status' | 'clientOrders'>
>;

/**
 * @deprecated Use `UpdateEngagementPropertyRequest`. Retained for back-compat
 * during slice 8c migration.
 */
export type UpdateEngagementLoanRequest = UpdateEngagementPropertyRequest;

export interface CreateEngagementRequest {
  tenantId: string;
  client: EngagementClient;
  /** 1..1000 properties. Must have at least one. Each must have at least one client order. */
  properties: CreateEngagementPropertyRequest[];
  priority?: OrderPriority;
  clientDueDate?: string;
  internalDueDate?: string;
  totalEngagementFee?: number;
  accessInstructions?: string;
  specialInstructions?: string;
  engagementInstructions?: string;
  createdBy: string;
}

export interface UpdateEngagementRequest {
  client?: Partial<EngagementClient>;
  /** Direct property array replacement — use targeted methods (addProperty, updateProperty, etc.) instead. */
  properties?: EngagementProperty[];
  /** Recalculated automatically by addPropertyToEngagement / removeProperty. */
  engagementType?: EngagementType;
  status?: EngagementStatus;
  priority?: OrderPriority;
  clientDueDate?: string;
  internalDueDate?: string;
  totalEngagementFee?: number;
  accessInstructions?: string;
  specialInstructions?: string;
  engagementInstructions?: string;
  updatedBy: string;
}

export interface EngagementListRequest {
  tenantId: string;
  status?: EngagementStatus[];
  clientId?: string | undefined;
  priority?: OrderPriority[];
  /** Filter by first-property state (covers SINGLE; PORTFOLIO uses properties[0] as proxy). */
  propertyState?: string | undefined;
  propertyZipCode?: string | undefined;
  searchText?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  sortBy?: keyof Engagement | undefined;
  sortDirection?: 'ASC' | 'DESC' | undefined;
  authorizationFilter?: QueryFilter | undefined;
}

export interface EngagementListResponse {
  engagements: Engagement[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EngagementResponse {
  success: boolean;
  data?: Engagement;
  error?: string;
  message?: string;
}
