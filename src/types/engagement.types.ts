/**
 * Engagement Domain Types
 *
 * A LenderEngagement is the aggregate root for all valuation work on one or more loans.
 * It represents what a client (lender/AMC) hired us to produce.
 *
 * Hierarchy:
 *   LenderEngagement (1)
 *     └── EngagementLoan (1..1000) — one per property/loan in the portfolio
 *           └── EngagementProduct (1..N) — what was ordered per loan
 *                 └── vendorOrderIds (0..N) — what we ordered from vendors
 *
 * Lifecycles:
 *   Engagement:     RECEIVED → ACCEPTED → IN_PROGRESS → QC → DELIVERED
 *   EngagementLoan: PENDING → IN_PROGRESS → QC → DELIVERED
 *   VendorOrder:    NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → DELIVERED (to us)
 */

import { OrderPriority, PropertyDetails } from './order-management.js';

// ── Re-exports for consumers who only import from engagement.types ────────────
export { OrderPriority } from './order-management.js';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Whether the engagement covers a single loan or multiple loans (portfolio tape).
 * Auto-set by the service: SINGLE when loans.length === 1, PORTFOLIO otherwise.
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
 * Lifecycle for a single EngagementLoan within a portfolio engagement.
 * Independent of the parent EngagementStatus.
 */
export enum EngagementLoanStatus {
  PENDING     = 'PENDING',      // Loan received; work not yet begun
  IN_PROGRESS = 'IN_PROGRESS',  // Active vendor orders underway
  QC          = 'QC',           // Report under internal review
  DELIVERED   = 'DELIVERED',    // Deliverable sent to lender
  CANCELLED   = 'CANCELLED',    // Loan removed from engagement
}

/**
 * The status of a single product within an engagement loan.
 */
export enum EngagementProductStatus {
  PENDING     = 'PENDING',      // Not yet assigned to a vendor
  ASSIGNED    = 'ASSIGNED',     // Vendor order created
  IN_PROGRESS = 'IN_PROGRESS',
  DELIVERED   = 'DELIVERED',    // Vendor delivered; pending QC/report
  COMPLETED   = 'COMPLETED',    // Report delivered to lender
  CANCELLED   = 'CANCELLED',
}

/**
 * What the lender ordered from us (our service catalog).
 * NOTE: These are OUR products — not vendor fulfillment types.
 * A vendor may fulfill a single EngagementProductType with multiple VendorOrders.
 */
export enum EngagementProductType {
  FULL_APPRAISAL  = 'FULL_APPRAISAL',
  DRIVE_BY        = 'DRIVE_BY',
  EXTERIOR_ONLY   = 'EXTERIOR_ONLY',
  DESKTOP_REVIEW  = 'DESKTOP_REVIEW',
  FIELD_REVIEW    = 'FIELD_REVIEW',
  DESK_REVIEW     = 'DESK_REVIEW',
  AVM             = 'AVM',
  BPO             = 'BPO',
  ARV             = 'ARV',
  AVB             = 'AVB',
  ROV             = 'ROV',     // Reconsideration of Value (FHFA 2024)
  HYBRID          = 'HYBRID',  // Hybrid appraisal (inspector + desk appraiser)
}

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Org-level client context — who hired us.
 * Contains only lender/AMC-level fields. All loan-level fields live on EngagementLoan.
 */
export interface EngagementClient {
  clientId: string;
  clientName: string;
  loanOfficer?: string | undefined;
  loanOfficerEmail?: string | undefined;
  loanOfficerPhone?: string | undefined;
}

/**
 * A single deliverable product ordered for a specific loan.
 * One EngagementLoan may have multiple products (e.g., Full Appraisal + AVM).
 */
export interface EngagementProduct {
  /** ID scoped within the engagement document */
  id: string;
  productType: EngagementProductType;
  status: EngagementProductStatus;
  /** Instructions specific to this product from the lender */
  instructions?: string | undefined;
  /** What we charge the lender for this product */
  fee?: number | undefined;
  /** Lender-facing due date for this product */
  dueDate?: string | undefined; // ISO date
  /** VendorOrder IDs that contribute to fulfilling this product (0-N) */
  vendorOrderIds: string[];
}

/**
 * A single loan/property within an engagement.
 * For SINGLE engagements there is exactly one. For PORTFOLIO engagements there are 1..1000.
 * Embedded inside the Engagement document (loansStoredExternally = false).
 */
export interface EngagementLoan {
  /** ID generated by the service: loan-<ts>-<rand> */
  id: string;
  loanNumber: string;
  borrowerName: string;
  borrowerEmail?: string | undefined;
  loanOfficer?: string | undefined;
  loanOfficerEmail?: string | undefined;
  loanOfficerPhone?: string | undefined;
  loanType?: string | undefined;
  fhaCase?: string | undefined;
  /** FK → PropertyRecord.id — the canonical property record for this loan's collateral. Added Phase R0.4. */
  propertyId?: string;
  /**
   * @deprecated Use propertyId to reference the canonical PropertyRecord instead.
   * Retained as a display cache during Phase R0–R2 migration.
   */
  property: PropertyDetails;
  status: EngagementLoanStatus;
  /** Products ordered for this specific loan (1..N) */
  products: EngagementProduct[];
}

/**
 * Engagement — the aggregate root for all valuation work.
 *
 * Cosmos container: "engagements"
 * Partition key:    /tenantId
 *
 * Storage: loans are embedded in this document while loans.length ≤ 1000.
 * loansStoredExternally is reserved for a future external container path (not yet built).
 */
export interface Engagement {
  id: string;
  /** Human-readable reference: ENG-2026-001234 */
  engagementNumber: string;
  tenantId: string;

  // ── Type ──────────────────────────────────────────────────────────────────
  /** SINGLE when loans.length === 1; PORTFOLIO when loans.length > 1. Set by service. */
  engagementType: EngagementType;
  /** Always false until external loan container path is implemented. */
  loansStoredExternally: boolean;

  // ── Who ordered it ────────────────────────────────────────────────────────
  /** Org-level client. Loan-level fields (loanNumber, borrowerName, etc.) live on each EngagementLoan. */
  client: EngagementClient;

  // ── Loans ─────────────────────────────────────────────────────────────────
  /** 1..1000 loans, each with its own property and products. */
  loans: EngagementLoan[];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status: EngagementStatus;
  priority: OrderPriority;

  // ── Dates ─────────────────────────────────────────────────────────────────
  /** When we received the engagement from the lender */
  receivedAt: string;       // ISO datetime
  /** Lender's deadline for the final deliverable */
  clientDueDate?: string;   // ISO date
  /** Our internal working deadline */
  internalDueDate?: string; // ISO date
  /** When the engagement was closed (delivered or cancelled) */
  closedAt?: string;        // ISO datetime

  // ── Financials ────────────────────────────────────────────────────────────
  /** Sum of all EngagementProduct fees across all loans — what we charge the lender */
  totalEngagementFee?: number;  /** Links this Engagement to the QuickBooks Bill (Accounts Payable) generated for our vendors */
  quickbooksBillId?: string;
  // ── Instructions ──────────────────────────────────────────────────────────
  accessInstructions?: string;
  specialInstructions?: string;
  engagementInstructions?: string;

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

// =============================================================================
// REQUEST / RESPONSE SHAPES
// =============================================================================

/** Shape for each loan entry when creating an engagement. */
export type CreateEngagementLoanRequest = Omit<EngagementLoan, 'id' | 'status' | 'products'> & {
  products: Omit<EngagementProduct, 'id' | 'status' | 'vendorOrderIds'>[];
};

/** Patch shape for updating scalar fields on an existing loan (not products, not status). */
export type UpdateEngagementLoanRequest = Partial<
  Omit<EngagementLoan, 'id' | 'status' | 'products'>
>;

export interface CreateEngagementRequest {
  tenantId: string;
  client: EngagementClient;
  /** 1..1000 loans. Must have at least one. Each must have at least one product. */
  loans: CreateEngagementLoanRequest[];
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
  /** Direct loan array replacement — use targeted loan methods (addLoan, updateLoan, etc.) instead. */
  loans?: EngagementLoan[];
  /** Recalculated automatically by addLoanToEngagement / removeLoan. */
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
  /** Filter by first-loan property state (covers SINGLE; PORTFOLIO uses loans[0] as proxy). */
  propertyState?: string | undefined;
  propertyZipCode?: string | undefined;
  searchText?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  sortBy?: keyof Engagement | undefined;
  sortDirection?: 'ASC' | 'DESC' | undefined;
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
