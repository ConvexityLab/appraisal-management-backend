/**
 * Canonical Report Schema — v1.1.0
 *
 * UAD 3.6 / URAR (Form 1004) aligned.
 * This is the SINGLE source of truth for report data across both repos.
 * Frontend maintains an identical copy at src/types/canonical-schema.ts.
 *
 * Design principles:
 *   1. Field names match FNMA UAD 3.6 / MISMO 3.4 wherever a standard name exists.
 *   2. Sections mirror the URAR form layout so populating the form is a direct read.
 *   3. Vendor-native formats are stored separately (VendorDataRecord) and mapped
 *      into this canonical shape at ingestion time via typed mapper functions.
 *   4. The frontend never sees vendor-native formats — only canonical.
 *
 * Changelog:
 *   v1.1.0 (2026-03-11) — Phase 0.1/0.2/0.3:
 *     - Enhanced CostApproach with depreciation breakdown, soft costs, externalities
 *     - Enhanced IncomeApproach with vacancy, expenses, cap rate, DCF, rent comps
 *     - Enhanced Reconciliation with per-approach weights, confidence, sensitivity
 *     - Added ValueType enum and valueTypes/effectiveDates to CanonicalReportDocument
 *     - Replaced binary H&BU with structured HighestAndBestUse (4-test framework)
 *
 * @see URAR Form 1004 section references in JSDoc comments.
 * @see current-plan/CANONICAL_SCHEMA_PLAN.md for migration plan.
 */

export const SCHEMA_VERSION = '1.1.0';

// ═══════════════════════════════════════════════════════════════════════════════
// VALUE TYPE ENUM  (Phase 0.2 — supports multi-value-type assignments)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The type of value being estimated. An assignment may require one or more
 * value types (e.g. a rehab loan needs both AS_IS and PROSPECTIVE_AS_REPAIRED).
 */
export type ValueType =
  | 'AS_IS'
  | 'PROSPECTIVE_AS_COMPLETED'
  | 'PROSPECTIVE_AS_REPAIRED'
  | 'PROSPECTIVE_MARKET_RENT'
  | 'RETROSPECTIVE';

/** All valid ValueType literals for runtime validation. */
export const VALUE_TYPES: readonly ValueType[] = [
  'AS_IS',
  'PROSPECTIVE_AS_COMPLETED',
  'PROSPECTIVE_AS_REPAIRED',
  'PROSPECTIVE_MARKET_RENT',
  'RETROSPECTIVE',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHEST AND BEST USE — 4-TEST FRAMEWORK  (Phase 0.3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full H&BU analysis with the standard 4-test framework,
 * applied both as-vacant and as-improved per USPAP requirements.
 */
export interface HighestAndBestUse {
  asVacant: HbuTestSet;
  asImproved: HbuTestSet;
  /** Final H&BU conclusion narrative. */
  conclusion: string | null;
  /** Does the current use match the H&BU conclusion? */
  currentUseIsHbu: boolean | null;
  /** If not, what is the alternative highest and best use? */
  alternativeUse?: string | null;
}

/**
 * The 4 sequential tests for a single H&BU scenario (as-vacant OR as-improved).
 */
export interface HbuTestSet {
  /** Test 1: Is the use legally permissible under current zoning/regulations? */
  legallyPermissible: HbuTestResult | null;
  /** Test 2: Is the use physically possible given site constraints? */
  physicallyPossible: HbuTestResult | null;
  /** Test 3: Is the use financially feasible (yields positive return)? */
  financiallyFeasible: HbuTestResult | null;
  /** Test 4: Among feasible uses, which is maximally productive (highest value)? */
  maximallyProductive: HbuTestResult | null;
}

/**
 * Result of a single H&BU test.
 */
export interface HbuTestResult {
  passed: boolean;
  /** Narrative explanation of the test result. */
  narrative: string | null;
  /** Supporting evidence or data references. */
  supportingEvidence?: string | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VENDOR RAW STORAGE  (Cosmos container: vendor-data)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** Raw vendor payload stored in the `vendor-data` container for auditing and re-mapping. */
export interface VendorDataRecord {
  id: string;
  propertyId: string;
  reportId: string;
  vendorId: string; // e.g. "batch_data", "vendor_b", "vendor_c"
  dataType: 'comp_search' | 'property_detail' | 'mls_listing' | 'public_record';
  rawPayload: Record<string, unknown>;
  fetchedAt: string; // ISO-8601
  schemaVersion: string; // vendor's own schema version if known
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL ADDRESS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** URAR: Subject Section â€” Property Address block. */
export interface CanonicalAddress {
  streetAddress: string;
  unit: string | null;
  city: string;
  state: string; // 2-letter code
  zipCode: string; // 5-digit
  county: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL PROPERTY CORE  (shared fields for Subject + Comps)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Fields common to both the subject property and every comparable.
 * Names match UAD 3.6 / MISMO 3.4 standard.
 *
 * URAR sections covered:
 *   - Subject > Improvements  (page 1 middle)
 *   - Sales Comparison Grid   (page 2)
 */
export interface CanonicalPropertyCore {
  address: CanonicalAddress;

  // â”€â”€ Size & Layout (URAR: Improvements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Above-grade living area in square feet. FNMA standard name. */
  grossLivingArea: number;
  totalRooms: number;
  bedrooms: number;
  bathrooms: number; // full + half Ã— 0.5
  stories: number;

  // â”€â”€ Site (URAR: Site section) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  lotSizeSqFt: number;
  propertyType: string; // SFR, Condo, Townhouse, PUD, etc.

  // â”€â”€ Quality & Condition (UAD C1-C6 / Q1-Q6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  condition: string; // C1-C6
  quality: string; // Q1-Q6

  // â”€â”€ Design & Construction (URAR: Improvements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  design: string; // e.g. "Colonial", "Ranch", "Contemporary"
  yearBuilt: number;
  foundationType: string; // "Full Basement", "Crawl Space", "Slab", "Pier"
  exteriorWalls: string; // "Brick", "Vinyl Siding", "Wood", "Stucco"
  roofSurface: string; // "Asphalt Shingle", "Metal", "Tile"

  // â”€â”€ Basement (URAR: Improvements â€” Below Grade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  basement: string; // "Full", "Partial", "None"
  basementFinishedSqFt: number | null;

  // â”€â”€ Heating / Cooling / Energy (URAR: Improvements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  heating: string; // "FWA", "HWBB", "Radiant", "Other", "None"
  cooling: string; // "Central", "Wall Unit", "None"
  fireplaces: number;

  // â”€â”€ Garage / Carport (URAR: Improvements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  garageType: string; // "Attached", "Detached", "Built-In", "Carport", "None"
  garageSpaces: number;

  // â”€â”€ Other Improvements (URAR: Improvements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  porchPatioDeck: string; // description, e.g. "Open Porch, Deck"
  pool: boolean;
  attic: string; // "None", "Scuttle", "Stairs", "Finished"

  // â”€â”€ Form 1004 additional description fields (not in core UAD 3.6 spec) â”€â”€â”€
  /** Effective age in years (may differ from actual age due to updates). */
  effectiveAge?: number | null;
  /** Total basement square footage (finished + unfinished). */
  basementSqFt?: number | null;
  drivewaySurface?: string | null;
  gutters?: string | null;
  windowType?: string | null;
  stormWindows?: string | null;
  screens?: string | null;
  interiorFloors?: string | null;
  interiorWalls?: string | null;
  bathFloor?: string | null;
  /** Trim / finish material.  Note: Form 1004 label has a typo ("Tirm"). */
  trimFinish?: string | null;
  bathWainscot?: string | null;
  heatingFuel?: string | null;
  additionalFeatures?: string | null;
  conditionDescription?: string | null;
  siteDimensions?: string | null;
  siteShape?: string | null;
  /** More detailed view description than UAD view rating. */
  viewDescription?: string | null;
  zoningDescription?: string | null;

  // â”€â”€ View & Location (UAD View / Location ratings) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  view: string; // UAD view rating or description
  locationRating: string; // "Beneficial" | "Neutral" | "Adverse"

  // â”€â”€ Geolocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  latitude: number | null;
  longitude: number | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL SUBJECT PROPERTY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * The appraised property.
 *
 * URAR: Subject Section (page 1, top half)
 *       + Site Section
 *       + Improvements Section
 */
export interface CanonicalSubject extends CanonicalPropertyCore {
  // â”€â”€ Identification (URAR: Subject) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  parcelNumber?: string | null; // APN / Assessor's Parcel Number
  censusTract?: string | null;
  mapReference?: string | null; // tax map / plat reference
  currentOwner?: string | null;
  occupant?: 'Owner' | 'Tenant' | 'Vacant' | null;

  // â”€â”€ Legal (URAR: Subject) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  legalDescription?: string | null;

  // â”€â”€ Zoning (URAR: Site) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  zoning?: string | null; // classification code
  zoningCompliance?: 'Legal' | 'LegalNonConforming' | 'Illegal' | null;
  /**
   * @deprecated Use `highestAndBestUseAnalysis` for the full 4-test framework.
   * Retained for backward-compat with existing mappers and seed data.
   */
  highestAndBestUse?: 'Present' | 'Other' | null;
  /** Full H&BU analysis - as-vacant and as-improved with the 4-test framework. */
  highestAndBestUseAnalysis?: HighestAndBestUse | null;

  // â”€â”€ Flood (URAR: Site) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  floodZone?: string | null; // e.g. "X", "A", "AE"
  floodMapNumber?: string | null;
  floodMapDate?: string | null; // ISO date

  // â”€â”€ Utilities (URAR: Site) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  utilities?: CanonicalUtilities | null;

  // â”€â”€ Neighborhood (URAR: Neighborhood section, page 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  neighborhood?: CanonicalNeighborhood | null;

  // â”€â”€ Contract (URAR: Contract section, page 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  contractInfo?: CanonicalContractInfo | null;

  // â”€â”€ Market trend (supplemental) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  hpiTrend?: 'Increasing' | 'Stable' | 'Declining' | null;

  // â”€â”€ Form 1004 subject-only fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Tax year for the reported RE taxes. */
  taxYear?: number | null;
  /** Annual real estate taxes (from public record). */
  annualTaxes?: number | null;
  /** Carport spaces (separate from garageSpaces). */
  carportSpaces?: number | null;
  /** Site area unit. */
  siteAreaUnit?: 'sf' | 'acres' | null;
}

/** URAR: Site â€” Utilities row. */
export interface CanonicalUtilities {
  electricity: 'Public' | 'Other' | 'None';
  gas: 'Public' | 'Other' | 'None';
  water: 'Public' | 'Well' | 'Other' | 'None';
  sewer: 'Public' | 'Septic' | 'Other' | 'None';
}

/**
 * URAR: Neighborhood section (page 1, top-right quadrant).
 * Describes the market area around the subject.
 */
export interface CanonicalNeighborhood {
  locationType: 'Urban' | 'Suburban' | 'Rural';
  builtUp: 'Over 75%' | '25-75%' | 'Under 25%';
  growth: 'Rapid' | 'Stable' | 'Slow';
  propertyValues: 'Increasing' | 'Stable' | 'Declining';
  demandSupply: 'Shortage' | 'In Balance' | 'Over Supply';
  marketingTime: 'Under 3 months' | '3-6 months' | 'Over 6 months';
  predominantOccupancy: 'Owner' | 'Tenant' | 'Vacant';
  singleFamilyPriceRange: { low: number; high: number };
  predominantAge: string; // e.g. "20-40 years"
  presentLandUse: {
    singleFamily: number; // percentage
    multifamily: number;
    commercial: number;
    other: number;
  };
  boundaryDescription: string | null;
  neighborhoodDescription: string | null;
  marketConditionsNotes: string | null;
}

/**
 * URAR: Contract section (page 1).
 * Populated only when the subject is under contract.
 */
export interface CanonicalContractInfo {
  contractPrice: number | null;
  contractDate: string | null; // ISO date
  propertyRightsAppraised: 'Fee Simple' | 'Leasehold' | 'Other';
  financingConcessions: string | null;
  isPropertySeller: boolean | null; // is seller a financial institution?
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL COMPARABLE PROPERTY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * A comparable property â€” either a selected comp (on the URAR grid)
 * or a candidate (available for selection but not yet placed).
 *
 * URAR: Sales Comparison Approach grid (page 2)
 */
export interface CanonicalComp extends CanonicalPropertyCore {
  compId: string; // stable unique ID

  // â”€â”€ Sale Information (URAR: Sale grid columns) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  salePrice: number | null;
  saleDate: string | null; // ISO date
  priorSalePrice: number | null;
  priorSaleDate: string | null; // ISO date
  listPrice: number | null;
  financingType: string | null; // "Conventional", "FHA", "VA", "Cash", etc.
  saleType: string | null; // "ArmLength", "REO", "ShortSale", etc.
  concessionsAmount: number | null;

  // â”€â”€ Source Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  dataSource: 'mls' | 'public_record' | 'avm' | 'manual';
  vendorId: string; // which vendor provided this comp
  vendorRecordRef: string | null; // ID into vendor-data container for traceability

  // â”€â”€ Form 1004 comp-only supplemental fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Human-readable proximity string, e.g. "0.25 miles NE". */
  proximityToSubject?: string | null;
  /** Verification source, e.g. "County Records", "MLS #12345". */
  verificationSource?: string | null;
  /** Financing concessions description (text for Description column in grid). */
  saleFinancingConcessions?: string | null;
  /** Property rights description for this comp's Leasehold/Fee Simple cell. */
  propertyRights?: string | null;
  /** Second prior sale date for prior-transfer history block. */
  priorSaleDate2?: string | null;
  /** Second prior sale price for prior-transfer history block. */
  priorSalePrice2?: number | null;

  // â”€â”€ Distance & Proximity (URAR: proximity column) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  distanceFromSubjectMiles: number;
  proximityScore: number | null; // 0-100 if vendor-computed

  // â”€â”€ Selection State (workspace UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** true = appraiser has selected this comp for the grid. */
  selected: boolean;
  /** 1-6 grid slot if selected; null if candidate. */
  slotIndex: number | null;

  // â”€â”€ Adjustments (URAR: adjustment grid â€” populated for selected comps) â”€â”€â”€
  adjustments: CanonicalAdjustments | null;

  // â”€â”€ Extension Data (non-UAD enrichment from source) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mlsData: MlsExtension | null;
  publicRecordData: PublicRecordExtension | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL ADJUSTMENTS  (FNMA 1004 Sales Comparison Grid)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Line-item adjustments matching the URAR / FNMA 1004 adjustment grid.
 * All values are dollar amounts (positive = comp inferior, negative = comp superior).
 *
 * URAR: Page 2, Sales Comparison Approach grid rows.
 */
export interface CanonicalAdjustments {
  // â”€â”€ Transactional Adjustments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  saleOrFinancingConcessions: number;
  dateOfSaleTime: number;

  // â”€â”€ Location Adjustments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  locationAdj: number;
  leaseholdFeeSimple: number;
  site: number;
  viewAdj: number;

  // â”€â”€ Physical Adjustments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  designAndAppeal: number;
  qualityOfConstruction: number;
  actualAge: number;
  conditionAdj: number;
  aboveGradeRoomCount: number;
  aboveGradeBedroom: number;
  aboveGradeBathroom: number;
  grossLivingAreaAdj: number;
  basementAndFinishedRooms: number;
  functionalUtility: number;
  heatingCooling: number;
  energyEfficiency: number;
  garageCarport: number;
  porchPatioPool: number;

  // â”€â”€ Other â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  otherAdj1: number;
  otherAdj2: number;
  otherAdj3: number;

  // â”€â”€ Computed Totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Sum of all adjustments (preserving sign). */
  netAdjustmentTotal: number;
  /** Sum of absolute values of all adjustments. */
  grossAdjustmentTotal: number;
  /** salePrice + netAdjustmentTotal. */
  adjustedSalePrice: number;
  /** Net adjustment as percentage of the comparable's sale price. */
  netAdjustmentPct?: number | null;
  /** Gross adjustment as percentage of the comparable's sale price. */
  grossAdjustmentPct?: number | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXTENSION INTERFACES  (non-UAD enrichment data)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** MLS-sourced data that UAD doesn't cover but appraisers find useful. */
export interface MlsExtension {
  mlsNumber: string;
  listDate: string | null;
  soldDate: string | null;
  daysOnMarket: number | null;
  listingStatus: string; // "Active", "Pending", "Sold", "Withdrawn", etc.
  listingAgent: string | null;
  sellingAgent: string | null;
  photos: string[];
  propertyDescription: string | null;
  hoaFee: number | null;
  hoaFrequency: string | null; // "Monthly", "Annually"
  schoolDistrict: string | null;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  heating: string | null;
  cooling: string | null;
}

/** Public record data for tax and ownership verification. */
export interface PublicRecordExtension {
  parcelNumber?: string | null;
  taxAssessedValue: number | null;
  taxYear?: number | null;
  annualTaxAmount: number | null;
  legalDescription?: string | null;
  zoning: string | null;
  deedTransferDate: string | null;
  deedTransferAmount: number | null;
  ownerName: string | null;
  landUseCode: string | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL VALUATION RESULT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * URAR: Reconciliation section (page 2 bottom / page 3 top).
 * The appraiser's final value opinion.
 */
export interface CanonicalValuation {
  estimatedValue: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number | null; // 0-100
  effectiveDate: string; // ISO date â€” the "as of" date
  reconciliationNotes: string | null;
  approachesUsed: ('sales_comparison' | 'cost' | 'income')[];
  avmProvider: string | null;
  avmModelVersion: string | null;
  /** The value type(s) this valuation addresses (e.g. AS_IS, PROSPECTIVE_AS_COMPLETED). */
  valueType?: ValueType | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL REPORT METADATA  (report-generation context, not stored in vendor data)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Report-level context fields assembled at generation time from the AppraisalOrder
 * and appraiser profile. These do NOT come from vendor comp data â€” they come from
 * the order management system and are joined by the canonical document builder.
 *
 * Populated by FinalReportService before passing the document to ReportEngineService.
 */
export interface CanonicalReportMetadata {
  orderId: string;
  orderNumber: string | null;
  borrowerName: string | null;
  ownerOfPublicRecord: string | null;
  clientName: string | null;
  clientCompanyName: string | null;
  clientAddress: string | null;
  clientEmail: string | null;
  loanNumber: string | null;
  effectiveDate: string | null;
  inspectionDate: string | null;
  isSubjectPurchase: boolean;
  contractPrice: number | null;
  contractDate: string | null;
  subjectPriorSaleDate1: string | null;
  subjectPriorSalePrice1: number | null;
  subjectPriorSaleDate2: string | null;
  subjectPriorSalePrice2: number | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TOP-LEVEL REPORT DOCUMENT  (Cosmos container: reporting)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * The top-level document stored in the `reporting` container.
 *
 * This is the single shape that both backend and frontend agree on.
 * All data has been mapped from vendor-native format into canonical
 * before being written here.
 */
export interface CanonicalReportDocument {
  id: string; // Cosmos document ID
  reportId: string; // business-level report identifier
  orderId: string; // FK to orders container
  reportType: string; // "1004", "1073", "2055", etc.
  status: string;
  schemaVersion: string; // must equal SCHEMA_VERSION

  /**
   * Report-generation context assembled from the order + appraiser profile.
   * Not sourced from vendor comp data. Populated by FinalReportService.
   */
  metadata: CanonicalReportMetadata;

  /** URAR: Subject section (page 1). */
  subject: CanonicalSubject;

  /** URAR: Sales Comparison grid (page 2). All comps â€” candidates + selected. */
  comps: CanonicalComp[];

  /** URAR: Reconciliation (page 2-3). Null until valuation is run. */
  valuation: CanonicalValuation | null;
  // â”€â”€ Report generation additions (Phase 8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** URAR Reconciliation section â€” form-fill-ready; populated when appraisal is finalized. */
  reconciliation?: CanonicalReconciliation;
  /** Appraiser certification info â€” joined from appraiser profile at report-generation time. */
  appraiserInfo?: CanonicalAppraiserInfo;
  /** DVR/BPO-specific ratings and condition fields â€” only populated for DVR report types. */
  dvrDetail?: DvrSubjectDetail;
  /** Cost approach data â€” optional URAR section; required for Form 1073, 1025. */
  costApproach?: CanonicalCostApproach;
  /** Income approach data â€” optional for 1004; required for Form 1025. */
  incomeApproach?: CanonicalIncomeApproach;
  /** Photos resolved for report embedding: subject, comps, aerial, addenda. */
  photos?: ReportPhotoAsset[];
  // --- Phase 0.2: Value types & effective dates ---
  /** All value types requested for this assignment. */
  valueTypes?: ValueType[];
  /** Per-value-type effective dates (e.g. AS_IS -> inspection date, PROSPECTIVE -> completion date). */
  effectiveDates?: Partial<Record<ValueType, string>>;


  // â”€â”€ Metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAPPER INTERFACE  (implemented per vendor)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Every vendor mapper module must implement this interface.
 * The backend calls `mapToSubject` and `mapToComps` at ingestion time,
 * then writes the canonical result to the `reporting` container.
 */
export interface VendorMapper {
  readonly vendorId: string;
  mapToSubject(raw: Record<string, unknown>): CanonicalSubject;
  mapToComps(raw: Record<string, unknown>): CanonicalComp[];
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REPORT GENERATION SUPPLEMENTAL TYPES  (Phase 8)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * URAR: Reconciliation section (page 2 bottom / page 3 top) â€” form-fill-ready shape.
 * Supplements CanonicalValuation (which serves AVM / workspace comparison).
 */
export interface CanonicalReconciliation {
  salesCompApproachValue: number | null;
  costApproachValue: number | null;
  incomeApproachValue: number | null;
  /** The appraiser's final opinion of value. */
  finalOpinionOfValue: number;
  /** ISO date string â€” the "as of" effective date. */
  effectiveDate: string;
  reconciliationNarrative: string | null;
  /** e.g. "3-6 months" */
  exposureTime: string | null;
  marketingTime: string | null;
  // — Phase 0.1: Per-approach weighting & confidence ——————————————
  /** Appraiser-assigned weight to sales comparison approach (0-1, all weights should sum to 1). */
  salesCompWeight?: number | null;
  /** Appraiser-assigned weight to cost approach (0-1). */
  costWeight?: number | null;
  /** Appraiser-assigned weight to income approach (0-1). */
  incomeWeight?: number | null;
  /** QC / reviewer confidence in the final opinion (0-100). */
  confidenceScore?: number | null;
  /** Variance between highest and lowest approach values, as %. */
  approachSpreadPct?: number | null;

  // — Extraordinary assumptions & hypothetical conditions —————————
  extraordinaryAssumptions?: string[] | null;
  hypotheticalConditions?: string[] | null;
}

/**
 * Appraiser certification info â€” joined from the appraiser profile at report-generation time.
 * Populates the Appraiser Signature block on the URAR (page 3).
 */
export interface CanonicalAppraiserInfo {
  name: string;
  licenseNumber: string;
  /** 2-letter state code */
  licenseState: string;
  licenseType: 'Certified Residential' | 'Certified General' | 'Licensed' | 'Trainee';
  /** ISO date string */
  licenseExpirationDate: string;
  companyName: string;
  companyAddress: string;
  phone: string;
  email: string;
  /** ISO date string */
  signatureDate: string;
  supervisoryAppraiser?: Omit<CanonicalAppraiserInfo, 'supervisoryAppraiser'>;
}

/**
 * DVR / BPO-specific subject ratings and condition fields.
 * These use a different scale than UAD C1-C6 (Excellent/Good/Average/Fair/Poor).
 * Only populated when reportType is 'dvr' or 'bpo_exterior' / 'bpo_interior'.
 */
export interface DvrSubjectDetail {
  overallCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  interiorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  exteriorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  estimatedRepairCostLow: number | null;
  estimatedRepairCostHigh: number | null;
  /** Free-text list of major repairs required. */
  majorRepairsNeeded: string | null;
  occupancyStatus: 'Owner Occupied' | 'Tenant Occupied' | 'Vacant' | 'Unknown';
  occupantCooperation: 'Cooperative' | 'Uncooperative' | 'No Contact' | null;
  accessType: 'Interior' | 'Exterior Only' | 'Drive-By';
  /** Reviewerâ€™s estimate of days to sell at the as-is market value. */
  daysToSell: number | null;
  /** Reviewerâ€™s recommended list price. */
  listingPriceRecommendation: number | null;
  /** Percentage discount below market for a 30-day liquidation scenario. */
  quickSaleDiscount: number | null;
}

/**
 * URAR: Cost Approach section â€” optional for 1004, required for 1073 and 1025.
 */
export interface CanonicalCostApproach {
  // — Land value ———————————————————————————————————————————————————
  estimatedLandValue: number | null;
  landValueSource: string | null;
  /** Method used: 'sales_comparison' | 'allocation' | 'abstraction' | 'other' */
  landValueMethod?: string | null;
  /** Evidence: sale comps, allocations, or abstractions supporting land value. */
  landValueEvidence?: string | null;

  // — Replacement cost ————————————————————————————————————————————
  replacementCostNew: number | null;
  /** Cost factor source (e.g. 'Marshall & Swift', 'RSMeans', 'Builder Bid'). */
  costFactorSource?: string | null;
  /** Soft costs: architectural, engineering, permitting fees. */
  softCosts?: number | null;
  /** Builder/developer entrepreneurial profit. */
  entrepreneurialProfit?: number | null;
  /** Site improvements (driveways, landscaping, utility connections). */
  siteImprovementsCost?: number | null;

  // — Depreciation breakdown ——————————————————————————————————————
  depreciationAmount: number | null;
  /** e.g. "Age-Life", "Observed Condition", "Market Extraction" */
  depreciationType: string | null;
  /** Physical deterioration — curable. */
  physicalDepreciationCurable?: number | null;
  /** Physical deterioration — incurable (short-lived + long-lived). */
  physicalDepreciationIncurable?: number | null;
  /** Functional obsolescence (floor plan, design, energy inefficiency). */
  functionalObsolescence?: number | null;
  /** External (economic) obsolescence (location, market, environmental). */
  externalObsolescence?: number | null;
  /** Effective age used in age-life calculation. */
  effectiveAge?: number | null;
  /** Economic (total useful) life used in age-life calculation. */
  economicLife?: number | null;

  // — Result ——————————————————————————————————————————————————————
  depreciatedCostOfImprovements: number | null;
  indicatedValueByCostApproach: number | null;
  comments: string | null;
}

/**
 * URAR: Income Approach section â€” optional for 1004; required for 1025.
 */
export interface CanonicalIncomeApproach {
  // — Rent analysis ———————————————————————————————————————————————
  estimatedMonthlyMarketRent: number | null;
  /** Rent comps supporting the market rent estimate. */
  rentComps?: CanonicalRentComp[];

  // — GRM approach ————————————————————————————————————————————————
  grossRentMultiplier: number | null;

  // — Direct capitalization (1-4 unit income, small commercial) ———
  /** Potential Gross Income (PGI) — annual. */
  potentialGrossIncome?: number | null;
  /** Vacancy & credit loss rate (0-1). */
  vacancyRate?: number | null;
  /** Effective Gross Income (PGI × (1 - vacancy)). */
  effectiveGrossIncome?: number | null;
  /** Total operating expenses — annual. */
  operatingExpenses?: number | null;
  /** Replacement reserves — annual. */
  replacementReserves?: number | null;
  /** Net Operating Income (EGI - expenses - reserves). */
  netOperatingIncome?: number | null;
  /** Overall capitalization rate. */
  capRate?: number | null;
  /** Cap rate source/derivation (e.g. 'comparable_sales', 'band_of_investment'). */
  capRateSource?: string | null;

  // — DCF (optional, complex properties) ——————————————————————————
  /** Discount rate for DCF analysis. */
  discountRate?: number | null;
  /** Holding period in years for DCF. */
  holdingPeriodYears?: number | null;
  /** Terminal / reversion cap rate. */
  terminalCapRate?: number | null;
  /** DCF present value result. */
  dcfPresentValue?: number | null;

  // — Result ——————————————————————————————————————————————————————
  indicatedValueByIncomeApproach: number | null;
  comments: string | null;
}

/**
 * A single comparable rental used to support the market rent estimate.
 */
export interface CanonicalRentComp {
  address: string;
  proximityToSubject?: string | null;
  monthlyRent: number;
  dataSource?: string | null;
  /** Abbreviated property description (beds/baths/sf/condition). */
  propertyDescription?: string | null;
  /** Adjustments applied to derive subject market rent from this rental. */
  adjustedRent?: number | null;
}

/**
 * A single photo asset resolved for embedding in a generated report.
 * Populated by PhotoResolverService from the order's Blob-stored photos.
 */
export interface ReportPhotoAsset {
  orderId: string;
  /** Blob path the image was downloaded from */
  blobPath: string;
  photoType:
    | 'SUBJECT_FRONT'
    | 'SUBJECT_REAR'
    | 'SUBJECT_STREET'
    | 'SUBJECT_INTERIOR'
    | 'COMP_FRONT'
    | 'AERIAL'
    | 'FLOOR_PLAN'
    | 'ADDITIONAL';
  /** 1-6 for comp photos, matching CanonicalComp.slotIndex */
  compIndex?: number;
  caption?: string;
  /** ISO date when photo was taken */
  takenAt?: string;
}

