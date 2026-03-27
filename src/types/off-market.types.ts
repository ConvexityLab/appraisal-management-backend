/**
 * Off-Market Property Types
 *
 * Represents non-MLS property data useful for appraisal research:
 *   - Foreclosures / REO
 *   - Short sales
 *   - Private / pocket listings
 *   - Distressed sales
 *   - Bank-owned properties
 *
 * Stored in the `properties` Cosmos container with type = 'off-market-property'.
 * Partition key: /tenantId
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type OffMarketPropertyStatus =
  | 'active'          // Currently off-market but available
  | 'under_contract'  // Accepted offer, not yet closed
  | 'sold'            // Transaction completed
  | 'withdrawn'       // No longer available
  | 'pending'         // Awaiting bank/lender approval

export type OffMarketSaleType =
  | 'foreclosure'     // Lender-initiated foreclosure sale
  | 'reo'             // Real Estate Owned (bank-owned post-foreclosure)
  | 'short_sale'      // Lender agrees to accept less than owed
  | 'auction'         // Sold at public auction
  | 'pocket_listing'  // Never listed on MLS
  | 'probate'         // Estate sale through probate court
  | 'divorce'         // Court-ordered sale
  | 'tax_sale'        // County tax delinquency auction
  | 'private'         // Direct buyer/seller private sale

export type OffMarketDataSource =
  | 'manual'          // Manually entered by appraiser or staff
  | 'courthouse'      // Pulled from county courthouse records
  | 'attom'           // ATTOM Data Solutions
  | 'propstream'      // PropStream data feed
  | 'public_records'  // County public property records
  | 'import'          // Bulk CSV/file import

// ─── Core Document Type ──────────────────────────────────────────────────────

export interface OffMarketProperty {
  id: string;
  tenantId: string;
  type: 'off-market-property';

  // ── Property address ─────────────────────────────────────────────────────
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;

  // ── Property attributes ──────────────────────────────────────────────────
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType: string;   // 'Residential', 'Condo', 'Multi-Family', etc.

  // ── Transaction ──────────────────────────────────────────────────────────
  saleType: OffMarketSaleType;
  status: OffMarketPropertyStatus;
  listPrice?: number;
  salePrice?: number;
  /** ISO-8601 date the property became available or was listed */
  listDate?: string;
  /** ISO-8601 date sale was completed */
  saleDate?: string;

  // ── Distress context ─────────────────────────────────────────────────────
  loanAmount?: number;         // Outstanding lien/mortgage
  arrearsAmount?: number;      // Amount in default
  foreclosureStage?: 'pre-foreclosure' | 'lis-pendens' | 'auction' | 'reo';
  lenderName?: string;
  caseNumber?: string;

  // ── Provenance ───────────────────────────────────────────────────────────
  dataSource: OffMarketDataSource;
  sourceRecordId?: string;     // External ID from ATTOM, PropStream, etc.

  // ── Internal ─────────────────────────────────────────────────────────────
  notes?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── API Request / Response DTOs ─────────────────────────────────────────────

export interface CreateOffMarketPropertyRequest {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  saleType: OffMarketSaleType;
  status: OffMarketPropertyStatus;
  listPrice?: number;
  salePrice?: number;
  listDate?: string;
  saleDate?: string;
  loanAmount?: number;
  arrearsAmount?: number;
  foreclosureStage?: OffMarketProperty['foreclosureStage'];
  lenderName?: string;
  caseNumber?: string;
  dataSource?: OffMarketDataSource;
  sourceRecordId?: string;
  notes?: string;
}

export interface SearchOffMarketRequest {
  latitude?: number;
  longitude?: number;
  /** Miles — only used when lat/lon supplied */
  radiusMiles?: number;
  zipCode?: string;
  city?: string;
  status?: OffMarketPropertyStatus | OffMarketPropertyStatus[];
  saleType?: OffMarketSaleType | OffMarketSaleType[];
  dataSource?: OffMarketDataSource;
  /** ISO date string — sold/listed on or after */
  fromDate?: string;
  /** ISO date string — sold/listed on or before */
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface OffMarketPageResult {
  data: OffMarketProperty[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
