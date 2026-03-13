/**
 * Generic MLS Data Types
 *
 * Provider-agnostic interface for MLS (Multiple Listing Service) data.
 * Any concrete data source (Bridge Interactive, CoreLogic, Zillow,
 * or an in-memory seed) implements MlsDataProvider.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Listing — a single sold property record
// ═══════════════════════════════════════════════════════════════════════════════

export interface MlsListing {
  /** Provider-assigned unique key */
  id: string;
  /** Optional secondary listing ID */
  listingId?: string;

  // ── Location ────────────────────────────────────────────────────────────────
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;

  // ── Sale ─────────────────────────────────────────────────────────────────────
  salePrice: number;
  /** ISO-8601 date string (YYYY-MM-DD) */
  saleDate: string;

  // ── Property characteristics ─────────────────────────────────────────────────
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize?: number;
  propertyType: string;
  propertySubType?: string;

  // ── Provenance ───────────────────────────────────────────────────────────────
  /** Which data source supplied this record (e.g. "Bridge MLS", "Seed Data") */
  source: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Search parameters
// ═══════════════════════════════════════════════════════════════════════════════

export interface MlsSearchParams {
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  limit?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  soldWithinDays?: number;
  propertyType?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Abstract MLS data source.
 * Implementations may hit a real API, a database, or return seed data.
 */
export interface MlsDataProvider {
  /** Search for closed/sold listings matching the given criteria. */
  searchSoldListings(params: MlsSearchParams): Promise<MlsListing[]>;
}
