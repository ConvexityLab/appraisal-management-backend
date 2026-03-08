/**
 * Engagement Domain Types
 *
 * A LenderEngagement represents what a client (lender/AMC) hired us to produce.
 * It is the aggregate root for all valuation work associated with a loan.
 *
 * Distinct from VendorOrder (AppraisalOrder), which represents what we ordered
 * from a third-party vendor to fulfill the engagement.
 *
 * Lifecycle:
 *   Engagement: RECEIVED → ACCEPTED → IN_PROGRESS → QC → DELIVERED
 *   VendorOrder: NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → DELIVERED (to us)
 */

import { OrderPriority, PropertyDetails, ClientInformation } from './order-management.js';

// ── Re-exports for consumers who only import from engagement.types ────────────
export { OrderPriority } from './order-management.js';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * The overall lifecycle of a LenderEngagement.
 * Distinct from VendorOrderStatus which tracks the vendor-side fulfillment.
 */
export enum EngagementStatus {
  RECEIVED   = 'RECEIVED',    // Client submitted; awaiting our acceptance
  ACCEPTED   = 'ACCEPTED',    // We have accepted the engagement
  IN_PROGRESS = 'IN_PROGRESS', // At least one vendor order is underway
  QC         = 'QC',           // Report is under internal quality control
  REVISION   = 'REVISION',     // Revision requested (by client or QC)
  DELIVERED  = 'DELIVERED',    // Final deliverable sent to lender
  CANCELLED  = 'CANCELLED',
  ON_HOLD    = 'ON_HOLD',
}

/**
 * The status of a single product within an engagement.
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
 * The lender/client-facing context for an engagement.
 * Derived from ClientInformation but scoped to engagement-relevant fields.
 */
export interface EngagementClient {
  clientId: string;
  clientName: string;
  loanNumber: string;
  borrowerName: string;
  borrowerEmail?: string;
  loanOfficer?: string;
  loanOfficerEmail?: string;
  loanOfficerPhone?: string;
  loanType?: string;
  fhaCase?: string;
}

/**
 * A single deliverable product ordered by the lender.
 * One Engagement may have multiple products (e.g., Full Appraisal + AVM).
 */
export interface EngagementProduct {
  /** CUID scoped within the engagement */
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
 * Engagement — the aggregate root for all valuation work on a loan.
 *
 * Cosmos container: "engagements"
 * Partition key:    /tenantId
 */
export interface Engagement {
  id: string;
  /** Human-readable reference: ENG-2026-001234 */
  engagementNumber: string;
  tenantId: string;

  // ── Who ordered it ────────────────────────────────────────────────────────
  client: EngagementClient;

  // ── What property ─────────────────────────────────────────────────────────
  property: PropertyDetails;

  // ── What was ordered ──────────────────────────────────────────────────────
  products: EngagementProduct[];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status: EngagementStatus;
  priority: OrderPriority;

  // ── Dates ─────────────────────────────────────────────────────────────────
  /** When we received the engagement from the lender */
  receivedAt: string;      // ISO datetime
  /** Lender's deadline for the final deliverable */
  clientDueDate?: string;  // ISO date
  /** Our internal working deadline */
  internalDueDate?: string; // ISO date
  /** When the engagement was closed (delivered or cancelled) */
  closedAt?: string;       // ISO datetime

  // ── Financials ────────────────────────────────────────────────────────────
  /** Sum of all EngagementProduct fees — what we charge the lender */
  totalEngagementFee?: number;

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

export interface CreateEngagementRequest {
  tenantId: string;
  client: EngagementClient;
  property: PropertyDetails;
  products: Omit<EngagementProduct, 'id' | 'status' | 'vendorOrderIds'>[];
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
  property?: Partial<PropertyDetails>;
  products?: EngagementProduct[];
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
