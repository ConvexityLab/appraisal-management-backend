/**
 * PropertyComparableSale — Persisted Market Transaction Record
 *
 * A comparable sale is a MARKET EVENT — a specific sale that occurred on a
 * specific property at a specific point in time. It is distinct from the
 * PropertyRecord (the physical asset) and from the MlsListing interface (the
 * transient provider API response shape).
 *
 * Key design principles:
 *   1. Immutable once a sale is closed. A SOLD record is never updated.
 *      ACTIVE/PENDING listings may be updated until they close or expire.
 *   2. Linked to PropertyRecord via `propertyId` — resolved at ingestion time
 *      by APN match or normalized address match.
 *   3. Snapshots property characteristics AT TIME OF SALE — these may differ
 *      from the current PropertyRecord if the property was subsequently modified.
 *   4. `rawProviderData` is preserved for audit and re-processing.
 *
 * Cosmos container: `comparable-sales`  (partition key: /zipCode)
 *
 * This replaces the transient `MlsListing` interface as a storage target.
 * `MlsListing` remains as the provider API response DTO only.
 *
 * @see PROPERTY_DATA_REFACTOR_PLAN.md — Phase R0.2
 */

import type { PropertyIdResolutionMethod } from './property-record.types.js';

// ─── Status ───────────────────────────────────────────────────────────────────

export type ComparableSaleStatus =
  | 'ACTIVE'      // Currently listed for sale
  | 'PENDING'     // Under contract, not yet closed
  | 'SOLD'        // Sale closed — record is now immutable
  | 'EXPIRED'     // Listing expired without selling
  | 'WITHDRAWN'   // Seller withdrew the listing
  | 'CANCELLED';  // Contract cancelled before closing

// ─── Transaction Type ─────────────────────────────────────────────────────────

export type SaleTransactionType =
  | 'ARM_LENGTH'   // Standard market sale
  | 'REO'          // Bank-owned / foreclosure sale
  | 'SHORT_SALE'   // Pre-foreclosure short sale
  | 'AUCTION'      // Public auction
  | 'INTER_FAMILY' // Family/related-party transfer
  | 'ESTATE';      // Estate/probate sale

// ─── Financing Type ───────────────────────────────────────────────────────────

export type SaleFinancingType =
  | 'CONVENTIONAL'
  | 'FHA'
  | 'VA'
  | 'USDA'
  | 'CASH'
  | 'SELLER_FINANCING'
  | 'ASSUMED'
  | 'OTHER'
  | 'UNKNOWN';

// ─── PropertyComparableSale ───────────────────────────────────────────────────

/**
 * A single MLS/public-records sale event, persisted in our comparable-sales
 * container. Serves as the platform's institutional comp database — queryable
 * by property, geography, date range, and characteristics.
 */
export interface PropertyComparableSale {
  id: string;         // format: comp-<mlsNumber or hash>
  tenantId: string;

  // ── Property Link ──────────────────────────────────────────────────────────
  /**
   * FK → PropertyRecord.id.
   * Resolved at ingestion. UNRESOLVED means we could not match to an existing
   * PropertyRecord — a new PropertyRecord is created if APN or address is sufficient.
   */
  propertyId?: string;
  /** Which method resolved propertyId at ingestion time. */
  propertyIdResolvedBy?: PropertyIdResolutionMethod;

  // ── Sale Identity ──────────────────────────────────────────────────────────
  /** MLS listing number from the source provider. */
  mlsNumber?: string;
  /** Public records document number (deed, transfer). */
  publicRecordDocNumber?: string;
  /** Which MLS or data provider this record came from. */
  source: string;    // e.g. "Bridge MLS", "CRMLS", "Public Records", "Seed Data"
  status: ComparableSaleStatus;

  // ── Address (denormalized for direct querying without a join) ──────────────
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  latitude?: number;
  longitude?: number;

  // ── Sale Terms ─────────────────────────────────────────────────────────────
  salePrice: number;
  /** ISO date string (YYYY-MM-DD). */
  saleDate: string;
  listPrice?: number;
  /** ISO date string when listing went active. */
  listDate?: string;
  daysOnMarket?: number;
  /** Total seller concessions in USD. */
  concessionsAmount?: number;
  /** Text description of concessions for report grid. */
  concessionsDescription?: string;
  transactionType?: SaleTransactionType;
  financingType?: SaleFinancingType;
  propertyRights?: 'FEE_SIMPLE' | 'LEASEHOLD';

  // ── Property Characteristics AT TIME OF SALE ───────────────────────────────
  // These are a snapshot and may differ from the current PropertyRecord values
  // (e.g., if the property was rehabbed after the sale).
  /**
   * Which PropertyRecord.recordVersion was current on the sale date.
   * Null if property was first encountered via this comp (no prior PropertyRecord).
   */
  propertyCaptureVersion?: number;
  glaAtSale: number;               // Gross Living Area in sq ft
  bedroomsAtSale: number;
  bathroomsAtSale: number;
  yearBuilt?: number;
  lotSizeSqFt?: number;
  propertyType?: string;
  condition?: string;
  quality?: string;
  garageSpaces?: number;
  basement?: boolean;
  pool?: boolean;
  stories?: number;
  constructionType?: string;

  // ── Prior Sale (for comp grid's prior sale section) ────────────────────────
  priorSalePrice?: number;
  priorSaleDate?: string;          // ISO date

  // ── Comp Usage Tracking (populated over time) ──────────────────────────────
  /**
   * IDs of CanonicalReportDocument records that selected this sale as a comp.
   * Enables: "Was this comp used in a prior appraisal?" and usage analytics.
   */
  usedInReportIds?: string[];

  // ── Raw Provider Data ──────────────────────────────────────────────────────
  /** Preserved verbatim from the MLS provider for audit and re-processing. */
  rawProviderData?: unknown;

  // ── Metadata ───────────────────────────────────────────────────────────────
  ingestedAt: string;   // ISO timestamp — when we first received/stored this record
  updatedAt: string;    // ISO timestamp — last update (for ACTIVE/PENDING status changes)
  ingestedBy: string;   // userId or 'SYSTEM'
}

// ─── Comp Search Filters ──────────────────────────────────────────────────────

export interface ComparableSaleSearchFilters {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  limit?: number;
  /** ISO date string — only sales on or after this date. */
  saleDateMin?: string;
  /** ISO date string — only sales on or before this date. */
  saleDateMax?: string;
  salePriceMin?: number;
  salePriceMax?: number;
  glaMin?: number;
  glaMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  propertyType?: string[];
  status?: ComparableSaleStatus[];
  transactionType?: SaleTransactionType[];
}

// ─── Ingestion DTO ────────────────────────────────────────────────────────────

/**
 * Maps an MlsListing (transient provider response) to the fields needed
 * to create or update a PropertyComparableSale document.
 * Used internally by ComparableSaleService — not an API-facing type.
 */
export interface CreateComparableSaleFromMlsInput {
  mlsNumber?: string;
  source: string;
  status: ComparableSaleStatus;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  salePrice: number;
  saleDate: string;
  listPrice?: number;
  listDate?: string;
  daysOnMarket?: number;
  glaAtSale: number;
  bedroomsAtSale: number;
  bathroomsAtSale: number;
  yearBuilt?: number;
  lotSizeSqFt?: number;
  propertyType?: string;
  concessionsAmount?: number;
  rawProviderData?: unknown;
  tenantId: string;
  ingestedBy: string;
}
