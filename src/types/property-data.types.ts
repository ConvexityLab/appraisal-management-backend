/**
 * Property Data Provider Types
 *
 * Provider-agnostic interface for subject property data enrichment.
 * Any concrete data source (Bridge Interactive, ATTOM, CoreLogic, etc.)
 * implements PropertyDataProvider.
 *
 * This is the parallel to MlsDataProvider — but for lookup of a specific
 * known address rather than comp searching.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Lookup params
// ═══════════════════════════════════════════════════════════════════════════════

export interface PropertyDataLookupParams {
  /** Full street address, e.g. "1234 Main St" */
  street: string;
  city: string;
  state: string;
  zipCode: string;
  /** Optional — dramatically improves match accuracy */
  apn?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Result — canonical field names matching CanonicalPropertyCore / CanonicalSubject
// ═══════════════════════════════════════════════════════════════════════════════

/** Core building characteristics returned from a provider lookup. */
export interface PropertyDataCore {
  /** Above-grade living area (sq ft) */
  grossLivingArea?: number | null;
  totalRooms?: number | null;
  bedrooms?: number | null;
  bathsFull?: number | null;
  bathsHalf?: number | null;
  yearBuilt?: number | null;
  effectiveAge?: number | null;
  lotSizeSqFt?: number | null;
  propertyType?: string | null;
  stories?: number | null;
  garage?: string | null;
  basement?: string | null;
  /** Assessor Parcel Number */
  parcelNumber?: string | null;
  /** Normalized county name */
  county?: string | null;
  /** Latitude from geocoding */
  latitude?: number | null;
  /** Longitude from geocoding */
  longitude?: number | null;
}

/** Public-record tax and ownership data. */
export interface PropertyDataPublicRecord {
  taxAssessedValue?: number | null;
  taxYear?: number | null;
  annualTaxAmount?: number | null;
  legalDescription?: string | null;
  zoning?: string | null;
  deedTransferDate?: string | null;   // ISO YYYY-MM-DD
  deedTransferAmount?: number | null;
  ownerName?: string | null;
  landUseCode?: string | null;
}

/** FEMA flood zone data. */
export interface PropertyDataFlood {
  femaFloodZone?: string | null;       // e.g. "X", "AE", "A"
  femaMapNumber?: string | null;
  femaMapDate?: string | null;         // ISO YYYY-MM-DD
}

/**
 * Aggregated result from a PropertyDataProvider lookup.
 * All sections are optional — providers may only supply a subset.
 * null means the provider responded but the field was absent.
 * undefined means the section was not attempted.
 */
export interface PropertyDataResult {
  /** Identifies which provider supplied this data */
  source: string;
  /** ISO timestamp of when the lookup was performed */
  fetchedAt: string;

  core?: PropertyDataCore;
  publicRecord?: PropertyDataPublicRecord;
  flood?: PropertyDataFlood;

  /** Raw provider response, retained for traceability */
  rawProviderData?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Abstract subject property data source.
 * Returns null when the provider found no matching record for the address.
 */
export interface PropertyDataProvider {
  /**
   * Look up property data for the given address.
   * @returns PropertyDataResult if the provider found a match; null if no record found.
   * @throws if the provider returned an error (not a miss).
   */
  lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null>;
}
