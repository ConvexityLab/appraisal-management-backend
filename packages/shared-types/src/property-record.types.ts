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

import type { PropertyPhoto } from './canonical-schema';

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
    | 'APPRAISER_INSPECTION'
    | 'CANONICAL_SNAPSHOT'
    | 'DOCUMENT_EXTRACTION'
    | 'BULK_IMPORT'
    | 'AI_AGENT';
  /**
   * Granular provider/source identifier when `source` is a generic bucket.
   * Free-form string supplied by the caller — for `PUBLIC_RECORDS_API` versions
   * this is the `PropertyDataResult.source` of the provider that produced the
   * data, e.g. `'ATTOM Data Solutions (Cosmos cache)'`, `'Bridge Interactive'`,
   * or `'ATTOM Data Solutions'`. Optional for backward compatibility with
   * existing version entries.
   */
  sourceProvider?: string;
  /** Pointer to any underlying artifacts responsible for this version. For extracted text, this is the document ID. For bulk imports, the job ID. */
  sourceArtifactId?: string;
  /** Top-level field paths that changed, e.g. ["building.bedrooms", "zoning"]. */
  changedFields: string[];
  /** Snapshot of the changed values BEFORE this version. Useful for diffs. */
  previousValues: Record<string, unknown>;
  /** Snapshot of the changed values AFTER this version. Makes field-level provenance tracking fast and deterministic. */
  newValues?: Record<string, unknown>;
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

  // ── Photos ────────────────────────────────────────────────────────────────
  /**
   * URL-based photos of the property. Sourced from vendor data (e.g. ATTOM
   * `PHOTOSCOUNT`/`PHOTOKEY`/`PHOTOURLPREFIX`). HTTPS URLs only — never blob
   * paths. Empty array when the source row reported zero photos.
   * Flows through to `CanonicalPropertyCore.photos` on downstream comps.
   */
  photos?: PropertyPhoto[];

  // ── Ownership ─────────────────────────────────────────────────────────────
  currentOwner?: string;
  ownerOccupied?: boolean;

  // ── Tax & Assessment History ───────────────────────────────────────────────
  /** One entry per tax year. Append-only — never overwrite historical records. */
  taxAssessments: TaxAssessmentRecord[];

  // ── Permit History ────────────────────────────────────────────────────────
  /** All known permits on record. Append-only. */
  permits: PermitRecord[];

  // ── Automated Valuation ───────────────────────────────────────────────────
  /**
   * Most recent AVM estimate from Bridge Interactive (Zillow Zestimate).
   * Fetched at enrichment time (subject) or comp-collection time (comparables).
   * Optional — absent when the Bridge API returned no result or was unreachable.
   */
  avm?: {
    /** Estimated market value in USD. */
    value: number;
    /** ISO timestamp of when this estimate was fetched. */
    fetchedAt: string;
    source: 'bridge-zestimate';
    /** Zillow confidence score 0–1, when present in the API response. */
    confidence?: number;
  };

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
  /**
   * Granular identifier of the provider behind the most recent verified update.
   * Mirrors the `sourceProvider` on the latest `versionHistory` entry written by
   * the enrichment pipeline — surfaced as a top-level field so callers can
   * answer "where did the current data come from?" with a single field read,
   * without scanning version history.
   * Free-form string, e.g. `'ATTOM Data Solutions (Cosmos cache)'`,
   * `'Bridge Interactive'`, or `'ATTOM Data Solutions'`.
   */
  lastVerifiedSource?: string;

  // ── Projection lineage ───────────────────────────────────────────────────
  /** ISO timestamp when `currentCanonical` was most recently materialized. */
  projectedAt?: string;
  /** Projector implementation version that produced the current materialization. */
  projectionVersion?: string;
  /** Snapshot id associated with the latest applied projection, when present. */
  latestSnapshotId?: string;
  /** ISO timestamp of the latest immutable projection observation applied. */
  latestObservationAt?: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // ── Canonical accumulation (per-Property rolling view) ───────────────────
  /**
   * Property-level rolling canonical view. Updated after every
   * CanonicalSnapshot build that targets this property — the
   * canonical-snapshot service projects the property-scoped branches
   * (subject, transactionHistory, avmCrossCheck, riskFlags) back to
   * this field via PropertyRecordService.createVersion.
   *
   * Order-scoped branches (comps, loan, ratios, valuation, reconciliation,
   * compStatistics) intentionally do NOT live here — they belong to the
   * specific ClientOrder run. The frozen per-order CanonicalSnapshot
   * remains the reproducibility record for QC; this field is the
   * cross-order accumulation that lets next year's refi read last year's
   * accumulated subject + prior-sale state for free.
   *
   * Optional because legacy property records don't carry it; absence is
   * treated the same as an empty view by the snapshot service.
   */
  currentCanonical?: PropertyCurrentCanonicalView;
}

// ─── Property-level rolling canonical view ────────────────────────────────────

/**
 * The property-scoped projection of CanonicalReportDocument that
 * accumulates across all ClientOrders against the same parcel. See
 * `PropertyRecord.currentCanonical` for usage.
 *
 * Mirrors a strict subset of CanonicalReportDocument; the field types
 * are imported as `import type` to avoid a circular dep with
 * canonical-schema.ts (PropertyRecord is consumed by some canonical
 * mappers).
 */
export interface PropertyCurrentCanonicalView {
  /** Latest known subject characteristics (address, building, condition, …). */
  subject?: import('./canonical-schema').CanonicalSubject;
  /** All known prior sales / transfers of this property — accumulates across orders. */
  transactionHistory?: import('./canonical-schema').CanonicalTransactionHistory;
  /** Latest AVM cross-check we've seen for this property. */
  avmCrossCheck?: import('./canonical-schema').CanonicalAvmCrossCheck;
  /** Property-level risk flags (chain-of-title etc. — not order-scoped). */
  riskFlags?: import('./canonical-schema').CanonicalRiskFlags;
  /** ISO timestamp of the most recent snapshot that updated this view. */
  lastSnapshotAt?: string;
  /** Snapshot id that produced the most recent update — for traceability. */
  lastSnapshotId?: string;
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
