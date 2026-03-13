/**
 * PropertyRecord — The Canonical Physical Asset Type
 *
 * A PropertyRecord is the authoritative, versioned record of a physical
 * real-estate parcel. It is the aggregate root for ALL work performed on a
 * property: appraisals, construction loans, ARV analyses, reviews, and ROVs.
 *
 * Key design principles:
 *   1. Keyed by APN (Assessor Parcel Number) — the only government-stable identifier.
 *      Address strings are unreliable (typos, abbreviations, re-numbering).
 *   2. Versioned: each material change (permit close, zoning change, rehab) creates a
 *      new immutable version. Old versions are retained so historical reports remain
 *      legally reproducible under USPAP (reports reference propertyRecordVersion).
 *   3. Tax assessments and permits are time-series arrays — never overwritten.
 *   4. CanonicalAddress is the single address shape used throughout the platform —
 *      replaces the four different inline address structs scattered across the codebase.
 *
 * Cosmos container: `property-records`  (partition key: /tenantId)
 *
 * @see PROPERTY_DATA_REFACTOR_PLAN.md — Phase R0.1
 */

// ─── Canonical Address ────────────────────────────────────────────────────────

/**
 * The single normalized address shape used platform-wide.
 *
 * Replaces all inline address structs:
 *   - `{ street, city, state, zip }` in PropertySummary
 *   - `{ address, city, state, zipCode, county }` in PropertyDetails (order-management)
 *   - `{ street, city, state, zipCode, county }` in ConstructionLoan.propertyAddress
 *   - `{ streetAddress, city, state, zipCode, county }` in PropertyAddress (index.ts)
 *
 * Use USPS-normalized values (uppercase, full street type names) when storing.
 */
export interface CanonicalAddress {
  /** USPS-normalized street line, e.g. "123 MAIN STREET" */
  street: string;
  city: string;
  /** Two-letter state code, uppercase: "CA", "TX" */
  state: string;
  /** 5-digit ZIP code */
  zip: string;
  /** ZIP+4 when available */
  zipPlus4?: string;
  county?: string;
  /** FIPS county code, e.g. "06037" */
  countyFips?: string;
  /** Unit / suite / apt — kept separately so parcel matching can ignore it */
  unit?: string;
  latitude?: number;
  longitude?: number;
  /** True when this address has been validated and normalized via geocoding API */
  isNormalized?: boolean;
  /** ISO timestamp of last geocoding verification */
  geocodedAt?: string;
}

// ─── Version History Entry ────────────────────────────────────────────────────

/** Records a single material change to the physical property. */
export interface PropertyVersionEntry {
  /** The version number this entry describes (1-based). */
  version: number;
  createdAt: string;    // ISO timestamp
  createdBy: string;    // userId or 'SYSTEM'
  /** Human-readable reason for the version bump. */
  reason: string;
  /** Data source that triggered this version. */
  source:
    | 'PERMIT_CLOSE'
    | 'TAX_ASSESSMENT'
    | 'ZONING_CHANGE'
    | 'MANUAL_CORRECTION'
    | 'REHAB_COMPLETE'
    | 'PUBLIC_RECORDS_API'
    | 'APPRAISER_INSPECTION';
  /** Top-level field paths that changed, e.g. ["building.bedrooms", "zoning"]. */
  changedFields: string[];
  /** Snapshot of the changed values BEFORE this version. Useful for diffs. */
  previousValues: Record<string, unknown>;
}

// ─── Tax Assessment Record ────────────────────────────────────────────────────

/** Annual tax assessment from the county assessor. Appended each cycle. */
export interface TaxAssessmentRecord {
  taxYear: number;
  /** Total assessed value (land + improvements). */
  totalAssessedValue: number;
  landValue?: number;
  improvementValue?: number;
  /** Actual annual tax bill in USD. */
  annualTaxAmount?: number;
  /** Assessor's market value opinion (may differ from assessed value). */
  marketValue?: number;
  /** True if property is delinquent in this tax year. */
  isDelinquent?: boolean;
  /** ISO date of this assessment record. */
  assessedAt?: string;
}

// ─── Permit Record ────────────────────────────────────────────────────────────

/** A single building permit on record for this property. */
export interface PermitRecord {
  permitNumber: string;
  type: PermitType;
  description: string;
  issuedDate?: string;     // ISO date
  closedDate?: string;     // ISO date — when set, work is complete
  finalInspectionDate?: string;
  /** Declared job value in USD. */
  valuationAmount?: number;
  /** True when the permit materially changed property characteristics
   *  (bedrooms, GLA, structural) — triggers a new PropertyRecord version. */
  isMaterialChange: boolean;
  source?: string;          // 'COUNTY', 'CITY', 'PUBLIC_RECORDS_API', etc.
}

export type PermitType =
  | 'NEW_CONSTRUCTION'
  | 'ADDITION'
  | 'REMODEL'
  | 'ROOFING'
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HVAC'
  | 'DEMOLITION'
  | 'ADU'
  | 'POOL'
  | 'SOLAR'
  | 'OTHER';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum PropertyRecordType {
  SINGLE_FAMILY = 'single_family_residential',
  CONDO         = 'condominium',
  TOWNHOME      = 'townhome',
  MULTI_FAMILY  = 'multi_family',
  COMMERCIAL    = 'commercial',
  LAND          = 'land',
  MANUFACTURED  = 'manufactured_home',
  MIXED_USE     = 'mixed_use',
}

export enum PropertyRecordCondition {
  EXCELLENT = 'excellent',
  GOOD      = 'good',
  AVERAGE   = 'average',
  FAIR      = 'fair',
  POOR      = 'poor',
}

export enum BuildingQualityRating {
  A_PLUS = 'A+',
  A      = 'A',
  B_PLUS = 'B+',
  B      = 'B',
  C_PLUS = 'C+',
  C      = 'C',
  D      = 'D',
}

// ─── PropertyRecord ───────────────────────────────────────────────────────────

/**
 * Root document type for a real-estate parcel.
 *
 * This is the single source of truth for what physically exists at a parcel.
 * All other work entities (Engagement, ConstructionLoan, ArvAnalysis, etc.)
 * reference this record via `propertyId`.
 */
export interface PropertyRecord {
  id: string;         // our internal ID — format: prop-<apn-hash> or prop-<uuid>
  tenantId: string;

  // ── APN (primary stable key) ──────────────────────────────────────────────
  /** Assessor Parcel Number. Use as the merge/dedup key when available.
   *  Format varies by county: "1234-056-789", "123-45-678-01", etc. */
  apn?: string;
  /** FIPS state+county code prefix, e.g. "06037" (LA County). */
  fipsCode?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  /** USPS-normalized, geocoded address. Single source of truth for location. */
  address: CanonicalAddress;

  // ── Property Characteristics ──────────────────────────────────────────────
  propertyType: PropertyRecordType;
  zoning?: string;               // classification code, e.g. "R1", "C2"
  zoningDescription?: string;    // human-readable, e.g. "Single Family Residential"
  legalDescription?: string;
  subdivision?: string;
  lotSizeSqFt?: number;
  lotSizeAcres?: number;
  floodZone?: string;            // FEMA zone, e.g. "X", "AE"
  floodMapNumber?: string;
  floodMapDate?: string;         // ISO date

  // ── Building ──────────────────────────────────────────────────────────────
  building: {
    /** Gross Living Area in square feet — the primary size metric for residential. */
    gla: number;
    totalBuildingAreaSqFt?: number;
    yearBuilt: number;
    effectiveYearBuilt?: number;
    bedrooms: number;
    /** Total bathrooms (full + 0.5 per half-bath), e.g. 2.5. */
    bathrooms: number;
    fullBathrooms?: number;
    halfBathrooms?: number;
    stories?: number;
    garageSpaces?: number;
    carportSpaces?: number;
    basement?: boolean;
    basementSqFt?: number;
    constructionType?: string;   // 'Frame', 'Masonry', 'Steel Frame', etc.
    exteriorWalls?: string;      // 'Vinyl Siding', 'Brick', 'Stucco', etc.
    roofCover?: string;          // 'Asphalt Shingles', 'Tile', 'Metal', etc.
    heatSource?: string;
    airConditioning?: string;
    fireplaces?: number;
    pool?: boolean;
    condition?: PropertyRecordCondition;
    quality?: BuildingQualityRating;
  };

  // ── Ownership ─────────────────────────────────────────────────────────────
  currentOwner?: string;
  ownerOccupied?: boolean;

  // ── Tax & Assessment History ───────────────────────────────────────────────
  /** One entry per tax year. Append-only — never overwrite historical records. */
  taxAssessments: TaxAssessmentRecord[];

  // ── Permit History ────────────────────────────────────────────────────────
  /** All known permits on record. Append-only. */
  permits: PermitRecord[];

  // ── Versioning ────────────────────────────────────────────────────────────
  /**
   * Monotonically increasing version number. Starts at 1.
   * Incremented only on material changes (new bedroom added, rehab completes, etc.).
   * Minor corrections (typos, geocoding refinement) do NOT create a new version.
   */
  recordVersion: number;
  /** Full audit trail of every version increment. */
  versionHistory: PropertyVersionEntry[];

  // ── Data Provenance ───────────────────────────────────────────────────────
  dataSource: 'COUNTY_ASSESSOR' | 'PUBLIC_RECORDS_API' | 'MANUAL_ENTRY' | 'APPRAISER_ENTRY';
  dataSourceRecordId?: string;   // their reference ID
  /** ISO timestamp when this record was last verified against source data. */
  lastVerifiedAt?: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Resolution Utility Types ─────────────────────────────────────────────────

/**
 * How `PropertyRecordService.resolveOrCreate()` matched an incoming address/APN
 * to an existing PropertyRecord (or created a new one).
 */
export type PropertyIdResolutionMethod =
  | 'APN_MATCH'       // Exact APN match
  | 'ADDRESS_NORM'    // Normalized address match (no APN available)
  | 'MANUAL'          // Manually linked by a user
  | 'UNRESOLVED';     // No match found — record created as new parcel

export interface PropertyResolutionResult {
  propertyId: string;
  isNew: boolean;
  method: PropertyIdResolutionMethod;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/**
 * Input for creating a new PropertyRecord from an address string or struct.
 * Used internally by PropertyRecordService — not an API-facing type.
 */
export interface CreatePropertyRecordInput {
  address: CanonicalAddress;
  apn?: string;
  propertyType?: PropertyRecordType;
  building?: Partial<PropertyRecord['building']>;
  dataSource: PropertyRecord['dataSource'];
  dataSourceRecordId?: string;
  tenantId: string;
  createdBy: string;
}
