/**
 * Canonical Report Schema â v1.1.0
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
 *   4. The frontend never sees vendor-native formats â only canonical.
 *
 * Changelog:
 *   v1.1.0 (2026-03-11) â Phase 0.1/0.2/0.3:
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

  // ── Size & Layout (URAR v1.3: Dwelling Exterior + Unit Interior) ─────────
  /** Above-grade living area in square feet. FNMA standard name. */
  grossLivingArea: number;
  totalRooms: number;
  bedrooms: number;
  /**
   * @deprecated Use `bathsFull` + `bathsHalf` for URAR v1.3 compliance.
   * Retained for backward compatibility; equals bathsFull + bathsHalf × 0.5.
   */
  bathrooms: number;
  /** URAR v1.3: Full bathrooms count. Required for v1.3 forms. */
  bathsFull?: number | null;
  /** URAR v1.3: Half bathrooms count. Required for v1.3 forms. */
  bathsHalf?: number | null;
  stories: number;

  // ── URAR v1.3 Area Breakdown ────────────────────────────────────────────
  /** Total finished area including above + below grade. URAR v1.3 "Gross Building Finished Area". */
  grossBuildingFinishedArea?: number | null;
  /** Finished area above grade (standard ceiling height). */
  finishedAreaAboveGrade?: number | null;
  /** Finished area above grade with nonstandard ceiling height. */
  finishedAreaAboveGradeNonstandard?: number | null;
  /** Unfinished area above grade. */
  unfinishedAreaAboveGrade?: number | null;
  /** Finished area below grade (standard ceiling height). */
  finishedAreaBelowGrade?: number | null;
  /** Finished area below grade with nonstandard ceiling height. */
  finishedAreaBelowGradeNonstandard?: number | null;
  /** Unfinished area below grade. */
  unfinishedAreaBelowGrade?: number | null;
  /** Noncontinuous finished area not connected to main dwelling. */
  noncontinuousFinishedArea?: number | null;

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

  /** URAR v1.3: Construction method. */
  constructionMethod?: 'SiteBuilt' | 'Modular' | 'Manufactured' | null;
  /** URAR v1.3: Attachment type for townhouse/rowhouse. */
  attachmentType?: 'Attached' | 'Detached' | 'SemiDetached' | null;
  /** URAR v1.3: Structure design type (e.g. 1-Story, 2-Story, Split-Level). */
  structureDesign?: string | null;
  /** URAR v1.3: Individual structure identifier (unit #, bldg letter). */
  structureIdentifier?: string | null;
  /** URAR v1.3: Structure volume in cubic feet. */
  structureVolume?: number | null;
  /** URAR v1.3: Window surface area in sq ft. */
  windowSurfaceArea?: number | null;
  /** URAR v1.3: Remaining economic life in years. */
  remainingEconomicLife?: number | null;

  /** URAR v1.3: Dwelling style (e.g., Colonial, Ranch, Contemporary). */
  dwellingStyle?: string | null;
  /** URAR v1.3: Front door elevation / floor level. */
  frontDoorElevation?: string | null;
  /** URAR v1.3: Number of units in the structure containing the subject. */
  subjectPropertyUnitsInStructure?: number | null;

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
  effectiveAge?: number | null;
  basementSqFt?: number | null;
  drivewaySurface?: string | null;
  gutters?: string | null;
  windowType?: string | null;
  stormWindows?: string | null;
  screens?: string | null;
  interiorFloors?: string | null;
  interiorWalls?: string | null;
  bathFloor?: string | null;
  trimFinish?: string | null;
  bathWainscot?: string | null;
  heatingFuel?: string | null;
  additionalFeatures?: string | null;
  conditionDescription?: string | null;
  siteDimensions?: string | null;
  siteShape?: string | null;
  viewDescription?: string | null;
  zoningDescription?: string | null;

  // â”€â”€ View & Location (UAD View / Location ratings) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  view: string; // UAD view rating or description
  locationRating: string; // "Beneficial" | "Neutral" | "Adverse"

  /** URAR v1.3: View range (distance or descriptor). */
  viewRange?: string | null;
  /** URAR v1.3: Overall view impact on market value. */
  viewImpact?: 'Beneficial' | 'Neutral' | 'Adverse' | null;

  // ── Townhouse-specific fields (URAR v1.3: Dwelling Exterior) ──────────
  /** Townhouse: is this an end unit? */
  townhouseEndUnit?: boolean | null;
  /** Townhouse: is this a back-to-back unit? */
  townhouseBackToBack?: boolean | null;
  /** Townhouse: location description (e.g., Interior, End). */
  townhouseLocation?: string | null;
  /** Number of units above this unit. */
  unitsAbove?: number | null;
  /** Number of units below this unit. */
  unitsBelow?: number | null;

  // ── Per-feature Quality/Condition detail (URAR v1.3 Pages 12-14) ──────
  /** Exterior feature quality/condition breakdown. */
  exteriorQualityDetail?: CanonicalFeatureQualityCondition | null;
  /** Exterior feature condition breakdown. */
  exteriorConditionDetail?: CanonicalFeatureQualityCondition | null;
  /** Interior feature quality detail. */
  interiorQualityDetail?: CanonicalInteriorQualityCondition | null;
  /** Interior feature condition detail. */
  interiorConditionDetail?: CanonicalInteriorQualityCondition | null;

  // â”€â”€ Geolocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  latitude: number | null;
  longitude: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// URAR v1.3 — Per-Feature Quality/Condition Interfaces  (Phase 6A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Per-feature quality/condition ratings for exterior components.
 * URAR v1.3: Dwelling Exterior Q&C table (Pages 12-13).
 */
export interface CanonicalFeatureQualityCondition {
  walls?: string | null;
  foundation?: string | null;
  roof?: string | null;
  windows?: string | null;
  guttersDownspouts?: string | null;
  /** Overall exterior rating (Q1-Q6 or C1-C6). */
  overall?: string | null;
}

/**
 * Per-feature quality/condition ratings for interior components.
 * URAR v1.3: Unit Interior Q&C table (Pages 13-14).
 */
export interface CanonicalInteriorQualityCondition {
  kitchen?: string | null;
  bathrooms?: string | null;
  flooring?: string | null;
  wallsCeiling?: string | null;
  /** Overall interior rating (Q1-Q6 or C1-C6). */
  overall?: string | null;
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
  taxYear?: number | null;
  annualTaxes?: number | null;
  carportSpaces?: number | null;
  siteAreaUnit?: 'sf' | 'acres' | null;

  // ── URAR v1.3: Assignment & Listing (Phase 6A) ────────────────────────
  /** URAR v1.3: Listing status of the subject. */
  listingStatus?: string | null;
  /** URAR v1.3: Is the property valuation method other than Sales Comparison? */
  propertyValuationMethod?: string | null;
  /** URAR v1.3: Is the property on Native American Lands? */
  nativeAmericanLands?: boolean | null;

  // ── URAR v1.3: New Construction (Phase 6A) ────────────────────────────
  /** Is this a new construction property? */
  newConstruction?: boolean | null;
  /** Construction stage: Proposed, UnderConstruction, or Complete. */
  constructionStage?: 'Proposed' | 'UnderConstruction' | 'Complete' | null;

  // ── URAR v1.3: Property Rights & Restrictions (Phase 6A) ─────────────
  /** Is the site owned in common (condo/cooperative)? */
  siteOwnedInCommon?: boolean | null;
  /** Number of units excluding ADUs. */
  unitsExcludingAdus?: number | null;
  /** Number of accessory dwelling units. */
  accessoryDwellingUnits?: number | null;
  /** Property restrictions (deed, land trust, etc.). */
  propertyRestriction?: string | null;
  /** Encroachments description. */
  encroachment?: string | null;
  /** Special tax assessments or districts. */
  specialTaxAssessments?: string | null;
  /** Is the property part of a community land trust? */
  communityLandTrust?: boolean | null;
  /** Ground rent details (if leasehold). */
  groundRent?: CanonicalGroundRent | null;
  /** Are mineral rights leased? */
  mineralRightsLeased?: boolean | null;
  /** Are all rights included in the appraisal? */
  allRightsIncluded?: boolean | null;
  /** Rights not included. */
  rightsNotIncluded?: string | null;
  /** Is the homeowner responsible for exterior maintenance? */
  homeownerResponsibleForExteriorMaintenance?: boolean | null;
  /** Alternate physical address if different from primary. */
  alternatePhysicalAddress?: string | null;

  // ── URAR v1.3: Site Expansion (Phase 6A) ─────────────────────────────
  /** APN description. */
  apnDescription?: string | null;
  /** Number of parcels composing the site. */
  numberOfParcels?: number | null;
  /** Are all parcels contiguous? */
  contiguous?: boolean | null;
  /** Elements dividing non-contiguous parcels. */
  elementsDividingParcels?: string | null;
  /** Primary access to the site (Public, Private, etc.). */
  primaryAccess?: string | null;
  /** Street type (Public, Private). */
  streetType?: string | null;
  /** Street surface (Paved, Gravel, Dirt). */
  streetSurface?: string | null;
  /** Is there a road maintenance agreement? */
  maintenanceAgreement?: boolean | null;
  /** Apparent environmental conditions. */
  apparentEnvironmentalConditions?: string | null;
  /** Is broadband internet available? */
  broadbandInternetAvailable?: boolean | null;
  /** Is the dwelling within a utility easement? */
  dwellingWithinUtilityEasement?: boolean | null;
  /** Water frontage details. */
  waterFrontage?: CanonicalWaterFrontage | null;
  /** Adverse site influences. */
  siteInfluences?: CanonicalSiteInfluence[] | null;
  /** Notable site features. */
  siteFeatures?: CanonicalSiteFeature[] | null;

  // ── URAR v1.3: Unit Interior Expansion (Phase 6A) ────────────────────
  /** Is this a corner unit? */
  cornerUnit?: boolean | null;
  /** Floor number of the unit. */
  floorNumber?: number | null;
  /** Number of levels in the unit. */
  levelsInUnit?: number | null;
  /** Is this unit an ADU? */
  isAdu?: boolean | null;
  /** Is the ADU legally rentable? */
  legallyRentable?: boolean | null;
  /** Does the ADU have a separate postal address? */
  separatePostalAddress?: boolean | null;
  /** Kitchen update status (time frame, quality, condition). */
  kitchenUpdateStatus?: CanonicalUpdateStatus | null;
  /** Bathroom update status. */
  bathroomUpdateStatus?: CanonicalUpdateStatus | null;
  /** Accessibility features (ADA, ramps, etc.). */
  accessibilityFeatures?: string | null;

  // ── URAR v1.3: Defects & Condition (Phase 6A) ────────────────────────
  /** List of apparent defects, damages, or deficiencies. */
  defects?: CanonicalDefectItem[] | null;
  /** Overall as-is condition rating (C1-C6). */
  asIsOverallConditionRating?: string | null;
  /** Total estimated cost of repairs for all defects. */
  totalEstimatedCostOfRepairs?: number | null;

  // ── Condo / PUD supplemental (Phase 5 — Form 1073 / PUD addendum) ──────
  /** Condo project details — populated when propertyType is Condo or Cooperative. */
  condoDetail?: CanonicalCondoDetail | null;
  /** PUD project details — populated when propertyType is PUD. */
  pudDetail?: CanonicalPudDetail | null;
  /** HOA details — populated for Condo, PUD, and Townhouse properties. */
  hoaDetail?: CanonicalHoaDetail | null;
  /** Cooperative details — populated when propertyType is Co-op. */
  coopDetail?: CanonicalCoopDetail | null;
}

/** URAR: Site — Utilities row. */
export interface CanonicalUtilities {
  electricity: 'Public' | 'Other' | 'None';
  gas: 'Public' | 'Other' | 'None';
  water: 'Public' | 'Well' | 'Other' | 'None';
  sewer: 'Public' | 'Septic' | 'Other' | 'None';
}

// ═══════════════════════════════════════════════════════════════════════════════
// URAR v1.3 — New Supporting Interfaces  (Phase 6A)
// ═══════════════════════════════════════════════════════════════════════════════

/** Ground rent details. URAR v1.3 Subject Property + Project Information pages. */
export interface CanonicalGroundRent {
  annualAmount: number | null;
  /** Is the ground rent renewable at the end of the term? */
  renewable?: boolean | null;
  /** Lease term in years. */
  term?: number | null;
  /** Expiration date (ISO-8601). */
  expires?: string | null;
}

/** Water frontage details. URAR v1.3 Site section (Page 7). */
export interface CanonicalWaterFrontage {
  /** Does the property have private access to water frontage? */
  privateAccess?: boolean | null;
  /** Is the waterfront feature permanent? */
  permanentWaterfrontFeature?: boolean | null;
  /** Right to build on the waterfront? */
  rightToBuild?: boolean | null;
  /** Total linear measurement of water frontage. */
  totalLinearMeasurement?: number | null;
  /** Natural or man-made waterfront. */
  naturalOrManMade?: 'Natural' | 'ManMade' | null;
  /** Type of water body (ocean, lake, river, etc.). */
  waterBodyType?: string | null;
}

/** Site influence factor. URAR v1.3 Site section — repeating table. */
export interface CanonicalSiteInfluence {
  influence: string;       // e.g., "Traffic", "Railroad", "Airport"
  proximity: string;       // e.g., "Adjacent", "Within 1 mile"
  detail: string;
  impact: 'Beneficial' | 'Neutral' | 'Adverse';
  comment?: string | null;
}

/** Site feature. URAR v1.3 Site section — repeating table. */
export interface CanonicalSiteFeature {
  feature: string;         // e.g., "Topography", "Drainage", "Landscaping"
  detail: string;
  impact: 'Beneficial' | 'Neutral' | 'Adverse';
  comment?: string | null;
}

/** Kitchen or Bathroom update status. URAR v1.3 Unit Interior (Page 14). */
export interface CanonicalUpdateStatus {
  /** Time frame of update: e.g. "Within last 5 years", "6-15 years", "Not updated". */
  timeFrame?: string | null;
  /** Quality of update: Q1-Q6. */
  quality?: string | null;
  /** Condition of update: C1-C6. */
  condition?: string | null;
}

/** Apparent defect/damage/deficiency. URAR v1.3 Pages 4 & 37. */
export interface CanonicalDefectItem {
  /** Section reference: "Site", "Dwelling Exterior", "Unit Interior", etc. */
  feature: string | null;
  /** Structure/Unit identifier or location. */
  location: string | null;
  description: string | null;
  /** Does the defect affect soundness or structural integrity? */
  affectsSoundnessOrStructuralIntegrity: boolean | null;
  recommendedAction: string | null;
  estimatedCostToRepair: number | null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// CONDO / PUD / HOA DETAIL  (Phase 5 — UAD 3.6 Conditional Sections)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Form 1073: Condominium project details.
 * Required when propertyType is Condo or Cooperative.
 */
export interface CanonicalCondoDetail {
  projectName: string | null;
  projectType: 'Established' | 'New' | 'Conversion' | 'Gut Rehabilitation' | null;
  /** Total number of units in the project. */
  totalUnits: number | null;
  /** Number of units sold / closed. */
  unitsSold: number | null;
  /** Number of units currently for sale. */
  unitsForSale: number | null;
  /** Number of units rented (investor-owned). */
  unitsRented: number | null;
  /** % of project owned by single entity. FNMA flags > 10%. */
  ownerOccupancyPct: number | null;
  /** Is the project subject to additional phasing? */
  isPhased: boolean | null;
  /** Are common elements complete? */
  commonElementsComplete: boolean | null;
  /** Is there any pending litigation against the HOA or project? */
  pendingLitigation: boolean | null;
  pendingLitigationDetails: string | null;
  /** Special assessment amount, if any. */
  specialAssessment: number | null;
  specialAssessmentDetails: string | null;
  /** Developer/sponsor still in control of HOA? */
  developerControlled: boolean | null;
  /** Describe floors (unit's floor level, building total floors). */
  unitFloorLevel: number | null;
  buildingTotalFloors: number | null;
  comments: string | null;

  // ── Phase 7B-6 expansion ──────────────────────────────────────────────
  /** Source of project data (HOA, management company, developer, public records). */
  projectInfoDataSource?: string | null;
  /** Reason rented-unit count is estimated. */
  reasonUnitsRentedIsEstimated?: string | null;
  /** Project is complete? */
  projectComplete?: boolean | null;
  /** Building(s) complete? */
  buildingComplete?: boolean | null;
  /** Was the project converted in the past 3 years? */
  convertedInPast3Years?: boolean | null;
  /** Year of condo conversion. */
  yearConverted?: number | null;
  /** Observed deficiencies in common areas? */
  observedDeficiencies?: boolean | null;
  /** Description of observed deficiencies. */
  observedDeficienciesDescription?: string | null;
  /** % of space used for non-residential purposes. */
  nonResidentialUsePct?: number | null;
  /** Description of commercial/non-residential use. */
  commercialUseDescription?: string | null;
  /** Single entity ownership count. */
  singleEntityOwnedCount?: number | null;
  /** Single entity ownership %. FNMA flags > 10%. */
  singleEntityOwnershipPct?: number | null;
  /** Hotel/motel operation? */
  isHotelMotel?: boolean | null;
  /** Timeshare or segmented ownership? */
  isTimeshare?: boolean | null;
  /** Income/deed-restricted? */
  hasIncomeRestrictions?: boolean | null;
  /** Age-restricted community (55+)? */
  ageRestrictedCommunity?: boolean | null;
  /** Project-level ground rent applicable? */
  groundRent?: boolean | null;
  /** Project-level ground rent amount. */
  groundRentAmount?: number | null;
}

/**
 * PUD project / community details.
 * Required when propertyType is PUD.
 */
export interface CanonicalPudDetail {
  projectName: string | null;
  pudType: 'Detached' | 'Attached' | null;
  /** Total number of units/lots in the PUD. */
  totalUnits: number | null;
  /** Number of phases in the development. */
  totalPhases: number | null;
  /** Is the developer still in control of HOA? */
  developerControlled: boolean | null;
  /** Are common elements/amenities complete? */
  commonElementsComplete: boolean | null;
  /** Is the PUD subject to additional phases? */
  isPhased: boolean | null;
  comments: string | null;

  // ── Phase 7B-6 expansion ──────────────────────────────────────────────
  /** Source of project data. */
  projectInfoDataSource?: string | null;
  /** Units sold / closed. */
  unitsSold?: number | null;
  /** Units for sale. */
  unitsForSale?: number | null;
  /** Units rented. */
  unitsRented?: number | null;
  /** Owner occupancy percentage. */
  ownerOccupancyPct?: number | null;
  /** Project complete? */
  projectComplete?: boolean | null;
  /** Observed deficiencies in common areas? */
  observedDeficiencies?: boolean | null;
  /** Description of observed deficiencies. */
  observedDeficienciesDescription?: string | null;
}

/**
 * HOA details — applicable to Condo, PUD, and Townhouse properties.
 */
export interface CanonicalHoaDetail {
  /** Monthly/quarterly/annual HOA fee amount. */
  hoaFee: number | null;
  hoaFrequency: 'Monthly' | 'Quarterly' | 'Annually' | null;
  /** What the HOA fee covers (e.g., landscaping, pool, insurance). */
  hoaIncludes: string | null;
  /** Monthly special assessment amount, if any. */
  specialAssessmentAmount: number | null;
  /** Name of the management company. */
  managementCompany: string | null;

  // ── Phase 7B-6 expansion ──────────────────────────────────────────────
  /** Mandatory fees beyond HOA dues. */
  mandatoryFees?: number | null;
  /** Description of what mandatory fees cover. */
  mandatoryFeeDescription?: string | null;
  /** Utilities included in HOA/fees. */
  utilitiesIncluded?: string | null;
  /** HOA name. */
  hoaName?: string | null;
  /** HOA contact phone. */
  hoaContactPhone?: string | null;
  /** Reserve fund balance. */
  reserveFundBalance?: number | null;
  /** Reserve fund adequacy assessment. */
  reserveFundAdequacy?: 'Adequate' | 'Inadequate' | 'Unknown' | null;
  /** Annual budget amount. */
  annualBudgetAmount?: number | null;
  /** % of budget allocated to reserves. */
  reserveAllocationPct?: number | null;
  /** Units > 60 days delinquent on dues. */
  delinquentDues60Day?: number | null;
  /** % of units delinquent. */
  delinquentDuesPct?: number | null;
  /** Master/blanket insurance premium. */
  masterInsurancePremium?: number | null;
  /** What master policy covers. */
  masterInsuranceCoverage?: string | null;
  /** Fidelity bond amount. */
  fidelityBondCoverage?: number | null;
}

/**
 * Cooperative project details (Phase 7B-6).
 * Required when propertyType is Co-op.
 */
export interface CanonicalCoopDetail {
  /** Name of the cooperative corporation. */
  projectName?: string | null;
  /** Total shares outstanding in the corporation. */
  totalSharesOutstanding?: number | null;
  /** Shares attributable to the subject unit. */
  sharesAttributableToSubject?: number | null;
  /** Total shares issued. */
  sharesIssued?: number | null;
  /** Proprietary lease expiration date (ISO-8601). */
  proprietaryLeaseExpires?: string | null;
  /** Blanket financing on the cooperative? */
  blanketFinancing?: boolean | null;
  /** Underlying mortgage interest rate. */
  cooperativeInterestRate?: number | null;
  /** Remaining balance on blanket mortgage. */
  cooperativeUnderlyingMortgageBalance?: number | null;
  /** Monthly maintenance/carrying charge. */
  monthlyAssessment?: number | null;
  /** What assessment includes (taxes, insurance, utilities, etc.). */
  assessmentIncludes?: string | null;
  /** Management type. */
  cooperativeManagementType?: 'SelfManaged' | 'ProfessionallyManaged' | null;
  /** Managing agent name. */
  cooperativeManagementAgent?: string | null;
  /** Subletting policy. */
  subletPolicy?: 'Allowed' | 'Restricted' | 'NotAllowed' | null;
  /** Transfer/flip tax percentage. */
  flipTaxPct?: number | null;
  /** Board approval required for purchase? */
  boardApprovalRequired?: boolean | null;
  comments?: string | null;
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

  // ── URAR v1.3: Market Analysis Expansion (Phase 6C) ─────────────────────
  /** One-unit housing: predominant price. */
  predominantPrice?: number | null;
  /** One-unit housing: age range low (years). */
  ageRangeLow?: number | null;
  /** One-unit housing: age range high (years). */
  ageRangeHigh?: number | null;
  /** Housing supply: total active listings in the market area. */
  activeListingCount?: number | null;
  /** Housing supply: months of housing supply (inventory). */
  monthsOfSupply?: number | null;
  /** Housing supply: absorption rate (units sold per month). */
  absorptionRate?: number | null;
  /** Median sale price in the market area. */
  medianSalePrice?: number | null;
  /** Median days on market. */
  medianDaysOnMarket?: number | null;
  /** Price trend: 1-year percentage change. */
  priceTrend1Year?: number | null;
  /** Price trend: 3-year percentage change. */
  priceTrend3Year?: number | null;
  /** Number of comparable sales in last 12 months. */
  comparableSalesCount12Mo?: number | null;
  /** Number of comparable listings currently active. */
  comparableListingsActive?: number | null;
  /** Market conditions are consistent with the property values selection above? */
  marketConditionsConsistent?: boolean | null;

  // ── Phase 7B-5: Market Section Expansion ──────────────────────────────
  /** Search criteria used to select comps. */
  searchCriteriaDescription?: string | null;
  /** Active listing price low. */
  activeListingPriceLow?: number | null;
  /** Active listing price median. */
  activeListingPriceMedian?: number | null;
  /** Active listing price high. */
  activeListingPriceHigh?: number | null;
  /** Active listing median DOM. */
  activeListingMedianDOM?: number | null;
  /** Pending sales count. */
  pendingSalesCount?: number | null;
  /** Pending sale price low. */
  pendingSalePriceLow?: number | null;
  /** Pending sale price median. */
  pendingSalePriceMedian?: number | null;
  /** Pending sale price high. */
  pendingSalePriceHigh?: number | null;
  /** Comparable sales count: last 6 months. */
  salesCount6Mo?: number | null;
  /** Comparable sales count: last 3 months. */
  salesCount3Mo?: number | null;
  /** Distressed market competition (REO/short-sale prevalence). */
  distressedMarketCompetition?: string | null;
  /** Source for price trend data (e.g., MLS, Public Records). */
  priceTrendSource?: string | null;
  /** Price trend analysis commentary narrative. */
  priceTrendAnalysisCommentary?: string | null;
  /** Market commentary (replaces marketConditionsNotes going forward). */
  marketCommentary?: string | null;
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

  // ── URAR v1.3: Expanded Sales Contract fields (Phase 6A) ──────────────
  /** Is there a sales contract? */
  isSalesContract?: boolean | null;
  /** Was sales contract information analyzed? */
  wasContractAnalyzed?: boolean | null;
  /** Does this appear to be an arm's length transaction? */
  isArmLengthTransaction?: boolean | null;
  /** Commentary when non-arm's length. */
  nonArmLengthCommentary?: string | null;
  /** Transfer terms description. */
  transferTerms?: string | null;
  /** Personal property conveyed with the sale. */
  personalPropertyConveyed?: string | null;
  /** Known sales concessions description. */
  knownSalesConcessions?: string | null;
  /** Total dollar amount of sales concessions. */
  totalSalesConcessions?: number | null;
  /** Are the concessions typical for the market? */
  typicalForMarket?: boolean | null;
  /** Sales contract analysis narrative. */
  salesContractAnalysis?: string | null;
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
  /** Stable unique ID */
  compId: string;
  /** FK → PropertyRecord.id for this comp's physical address. Added Phase R0.3.
   *  Resolved at comp-selection time via PropertyRecordService. */
  propertyId?: string;
  /** FK → PropertyComparableSale.id — the specific sale event this comp represents.
   *  Populated when a comp is selected from the persistent comparable-sales container. Added Phase R0.3. */
  comparableSaleId?: string;
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
  proximityToSubject?: string | null;
  verificationSource?: string | null;
  saleFinancingConcessions?: string | null;
  propertyRights?: string | null;
  priorSaleDate2?: string | null;
  priorSalePrice2?: number | null;

  // -- URAR v1.3: Expanded comp descriptor fields (Phase 6C) ----------------
  // NOTE: constructionMethod, attachmentType, foundationType inherited from CanonicalPropertyCore
  /** View quality rating (URAR v1.3). */
  viewQuality?: string | null;
  /** View type description (URAR v1.3). */
  viewType?: string | null;
  /** Below grade finished area in sq ft. */
  belowGradeFinishedSqFt?: number | null;
  /** Below grade unfinished area in sq ft. */
  belowGradeUnfinishedSqFt?: number | null;
  /** Number of fireplaces. */
  fireplaceCount?: number | null;
  /** Pool present? */
  hasPool?: boolean | null;
  /** Fence type or description. */
  fencing?: string | null;

  // â”€â”€ Distance & Proximity (URAR: proximity column) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  distanceFromSubjectMiles: number;
  proximityScore: number | null; // 0-100 if vendor-computed


  // -- Phase 7C: URAR v1.3 Full Comp Expansion (Pages 26-29) ----------------

  // ── Transaction / Contract Detail ─────────────────────────────────────────
  /** Terms of sale / transfer (e.g., 'Conventional', 'Owner Financing'). */
  transferTerms?: string | null;
  /** Contract price at time of sale (may differ from sale price). */
  contractPrice?: number | null;
  /** Sale-to-list price ratio (e.g. 0.98 for 98%). */
  saleToListPriceRatio?: number | null;
  /** Property rights appraised (Fee Simple, Leasehold, etc.). */
  propertyRightsAppraised?: string | null;
  /** Days on market before sale. */
  daysOnMarket?: number | null;
  /** Was the comp a distressed sale (REO, Short Sale, Foreclosure)? */
  distressedSale?: boolean | null;
  /** Listing status at time of analysis. */
  compListingStatus?: 'Active' | 'Pending' | 'Sold' | 'Withdrawn' | 'Expired' | null;

  // ── Project / HOA Detail ──────────────────────────────────────────────────
  /** Project name (for condo/PUD comps). */
  projectName?: string | null;
  /** Is this comp in the same project as the subject? */
  sameProjectAsSubject?: boolean | null;
  /** Monthly HOA / condo fee. */
  monthlyFee?: number | null;
  /** Common amenities in the project (pool, gym, etc.). */
  commonAmenities?: string | null;
  /** Special assessments at time of sale. */
  specialAssessments?: string | null;

  // ── Site Detail (comp-specific, beyond inherited core) ────────────────────
  /** Is the site owned in common? */
  siteOwnedInCommon?: boolean | null;
  /** Neighborhood name / location descriptor. */
  neighborhoodName?: string | null;
  /** Zoning compliance (Legal, Legal Non-conforming, Illegal, etc.). */
  zoningCompliance?: string | null;
  /** Hazard zone designation (flood, seismic, wildfire). */
  hazardZone?: string | null;
  /** Primary access type (Public, Private, etc.). */
  primaryAccess?: string | null;
  /** Street type (Paved, Gravel, Dirt, etc.). */
  streetType?: string | null;
  /** Property restrictions (easements, deed restrictions, etc.). */
  propertyRestriction?: string | null;
  /** Easement description. */
  easement?: string | null;
  /** Topography description. */
  topography?: string | null;
  /** Drainage description. */
  drainage?: string | null;
  /** Site characteristics description. */
  siteCharacteristics?: string | null;
  /** Site influences (positive/negative environmental or locational). */
  siteInfluence?: string | null;
  /** Apparent environmental conditions. */
  apparentEnvironmentalConditions?: string | null;

  // ── Water Frontage ────────────────────────────────────────────────────────
  /** Type of water frontage (Ocean, Lake, River, Creek, Canal, etc.). */
  waterFrontageType?: string | null;
  /** Linear feet of water frontage. */
  waterFrontageLinearFeet?: number | null;
  /** Private waterfront access? */
  waterFrontagePrivateAccess?: boolean | null;
  /** Is water frontage permanent? */
  waterFrontagePermanent?: boolean | null;
  /** Natural vs man-made water feature. */
  waterFrontageNaturalManMade?: 'Natural' | 'Man-Made' | null;

  // ── Manufactured Home (comp-specific) ─────────────────────────────────────
  /** HUD Data Plate present? */
  hudDataPlate?: boolean | null;
  /** HUD Label / certification present? */
  hudLabel?: boolean | null;
  /** Manufactured home serial number. */
  serialNumber?: string | null;

  // ── Mechanical / HVAC (comp-specific) ─────────────────────────────────────
  /** HVAC system type (Forced Air, Radiant, etc.). */
  hvacType?: string | null;
  /** HVAC fuel type (Gas, Electric, Oil, etc.). */
  hvacFuel?: string | null;
  /** Estimated HVAC age in years. */
  hvacAge?: number | null;

  // ── Energy / Green Features ───────────────────────────────────────────────
  /** Green certification type (ENERGY STAR, LEED, etc.). */
  greenCertification?: string | null;
  /** Solar panels present? */
  solarPanels?: boolean | null;
  /** Energy rating (HERS, EPS score, etc.). */
  energyRating?: string | null;

  // ── Disaster Mitigation ───────────────────────────────────────────────────
  /** Summary of disaster mitigation features. */
  disasterMitigationSummary?: string | null;

  // ── Unit Detail (condo/multi-unit comps) ──────────────────────────────────
  /** Unit identifier within structure. */
  unitId?: string | null;
  /** ADU location if applicable. */
  aduLocation?: string | null;
  /** Floor number of the unit. */
  floorNumber?: number | null;
  /** Is this a corner unit? */
  cornerUnit?: boolean | null;
  /** Number of levels in the unit. */
  levelsInUnit?: number | null;
  /** Accessibility features present. */
  accessibilityFeatures?: string | null;

  // ── Overall Quality / Condition Ratings ───────────────────────────────────
  /** Overall quality rating (Q1-Q6 or descriptive). */
  overallQualityRating?: string | null;
  /** Overall condition rating (C1-C6 or descriptive). */
  overallConditionRating?: string | null;

  // ── Amenities (5 categories per URAR v1.3) ───────────────────────────────
  /** Porch/patio/deck description. */
  amenitiesPorchPatioDeck?: string | null;
  /** Pool / spa description. */
  amenitiesPoolSpa?: string | null;
  /** Fireplace description. */
  amenitiesFireplace?: string | null;
  /** Fence description. */
  amenitiesFence?: string | null;
  /** Other amenities description. */
  amenitiesOther?: string | null;

  // ── Vehicle Storage ───────────────────────────────────────────────────────
  /** Vehicle storage type (Attached Garage, Detached Garage, Carport, etc.). */
  vehicleStorageType?: string | null;
  /** Number of vehicle storage spaces. */
  vehicleStorageSpaces?: number | null;
  /** Vehicle storage detail / description. */
  vehicleStorageDetail?: string | null;

  // ── Outbuilding ───────────────────────────────────────────────────────────
  /** Outbuilding type (Barn, Shed, Workshop, Guest House, etc.). */
  outbuildingType?: string | null;
  /** Outbuilding gross building area. */
  outbuildingGBA?: number | null;
  /** Outbuilding finished area. */
  outbuildingFinishedArea?: number | null;
  /** Outbuilding unfinished area. */
  outbuildingUnfinishedArea?: number | null;
  /** Outbuilding volume in cubic feet. */
  outbuildingVolume?: number | null;
  /** Outbuilding has bathrooms? */
  outbuildingBaths?: number | null;
  /** Outbuilding has kitchen? */
  outbuildingKitchen?: boolean | null;
  /** Outbuilding has HVAC? */
  outbuildingHVAC?: boolean | null;
  /** Outbuilding has utilities? */
  outbuildingUtilities?: boolean | null;

  // ── Summary / Computed Fields ─────────────────────────────────────────────
  /** Adjusted price per unit. */
  adjustedPricePerUnit?: number | null;
  /** Adjusted price per bedroom. */
  adjustedPricePerBedroom?: number | null;
  /** Price per gross building finished area sf. */
  pricePerGrossBuildingFinishedArea?: number | null;
  /** Price per finished area above grade sf. */
  pricePerFinishedAreaAboveGrade?: number | null;
  /** Comparable weight assigned by appraiser (0-100%). */
  comparableWeight?: number | null;
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

  // -- URAR v1.3: Expanded adjustment rows (Phase 6C) ----------------------
  /** Construction method adjustment (site-built vs modular/manufactured). */
  constructionMethodAdj?: number;
  /** Attachment type adjustment (detached vs attached). */
  attachmentTypeAdj?: number;
  /** View impact adjustment (URAR v1.3 expanded view rating). */
  viewImpactAdj?: number;
  /** Foundation adjustment. */
  foundationAdj?: number;
  /** Below grade area adjustment. */
  belowGradeAdj?: number;
  /** Fireplace adjustment. */
  fireplaceAdj?: number;
  /** Pool adjustment. */
  poolAdj?: number;
  /** Fencing/exterior features adjustment. */
  fencingAdj?: number;


  // -- Phase 7C: Expanded adjustment rows for new comp fields ────────────────
  /** Water frontage adjustment. */
  waterFrontageAdj?: number;
  /** Outbuilding adjustment. */
  outbuildingAdj?: number;
  /** Vehicle storage adjustment. */
  vehicleStorageAdj?: number;
  /** Amenities (porch/patio/deck/pool/spa) adjustment. */
  amenitiesAdj?: number;
  /** Disaster mitigation features adjustment. */
  disasterMitigationAdj?: number;
  /** Green / energy features adjustment. */
  greenEnergyAdj?: number;
  /** Manufactured home features adjustment. */
  manufacturedHomeAdj?: number;
  /** Project / HOA fee adjustment. */
  projectHoaAdj?: number;
  /** Property rights adjustment. */
  propertyRightsAdj?: number;
  /** Transfer terms adjustment. */
  transferTermsAdj?: number;
  // â”€â”€ Computed Totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Sum of all adjustments (preserving sign). */
  netAdjustmentTotal: number;
  /** Sum of absolute values of all adjustments. */
  grossAdjustmentTotal: number;
  /** salePrice + netAdjustmentTotal. */
  adjustedSalePrice: number;
  netAdjustmentPct?: number | null;
  grossAdjustmentPct?: number | null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ── Phase 7C: Analyzed Properties Not Used ──────────────────────────────────

/** Properties analyzed but not selected as comparables. URAR v1.3 Pages 29-30. */
export interface CanonicalAnalyzedPropertyNotUsed {
  /** Street address. */
  address: string;
  /** Sale date (YYYY-MM-DD). */
  saleDate?: string | null;
  /** Sale price. */
  salePrice?: number | null;
  /** Listing status. */
  status?: 'Active' | 'Pending' | 'Sold' | 'Withdrawn' | 'Expired' | null;
  /** Reason this property was not used as a comparable. */
  reasonNotUsed: string;
  /** Additional comments. */
  comment?: string | null;
}

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
  parcelNumber: string | null;
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
  valueType?: ValueType | null;  // ── Broker DVR/BPO supplemental fields ────────────────────────────────────
  /** Prospective as-repaired value (rehab / DVR assignments). */
  estimatedValueAsRepaired?: number | null;
  /** Broker's estimated cost to bring the property to repaired condition. */
  repairEstimate?: number | null;
  /** Broker's recommended list price. */
  recommendedListPrice?: number | null;}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL REPORT METADATA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  /**
   * @deprecated Use `assignmentReason` for URAR v1.3 compliance.
   * Retained for backward compatibility; derive from assignmentReason === 'Purchase'.
   */
  isSubjectPurchase: boolean;
  contractPrice: number | null;
  contractDate: string | null;
  subjectPriorSaleDate1: string | null;
  subjectPriorSalePrice1: number | null;
  subjectPriorSaleDate2: string | null;
  subjectPriorSalePrice2: number | null;
  /**
   * Reviewer-assigned appraisal quality grade (A=Superior, B=Acceptable,
   * C=Marginal, D=Unacceptable). Only populated for DVR review report types.
   */
  appraisalGrade?: 'A' | 'B' | 'C' | 'D' | null;

  // ── URAR v1.3: Expanded assignment fields (Phase 6A) ───────────────────
  /**
   * Assignment reason enum — replaces the binary `isSubjectPurchase`.
   * Both are kept for backward compat; new code should prefer this.
   */
  assignmentReason?: 'Purchase' | 'Refinance' | 'Other' | null;
  /** Seller name (new in v1.3). */
  sellerName?: string | null;
  /** Appraiser fee for this assignment. */
  appraiserFee?: number | null;
  /** AMC fee for this assignment. */
  amcFee?: number | null;
  /** Government agency / investor requested special identification. */
  specialIdentification?: string | null;
  /** FHA REO insurability level. */
  fhaReoInsurabilityLevel?: string | null;
}


// -----------------------------------------------------------------------
// PRIOR TRANSFER HISTORY  (Phase 6B -- URAR v1.3 Section 5)
// -----------------------------------------------------------------------

/** A single prior transfer / sale record for subject or comp. */
export interface CanonicalPriorTransfer {
  /** Which property: 'subject' or comp identifier. */
  propertyRole: 'subject' | 'comp';
  /** Transaction date (YYYY-MM-DD). */
  transactionDate: string | null;
  /** Sale price in USD. */
  salePrice: number | null;
  /** Transfer type: sale, listing, agreement-of-sale, etc. */
  transferType: string | null;
  /** Data source for this transfer. */
  dataSource: string | null;
  /** Seller name. */
  seller: string | null;
  /** Buyer name. */
  buyer: string | null;
  /** Days on market prior to sale. */
  daysOnMarket: number | null;
  /** MLS number or other reference. */
  listingId: string | null;
  /** Whether this is a verified arm's-length transaction. */
  isArmsLength: boolean | null;
  /** Notes or qualifications about this transfer. */
  notes: string | null;
}

// -----------------------------------------------------------------------
// SCOPE OF WORK  (Phase 6B -- URAR v1.3 Section 6 / USPAP SR2)
// -----------------------------------------------------------------------

/** Structured scope-of-work description per USPAP Standards Rule 2. */
export interface CanonicalScopeOfWork {
  /** Extent of inspection: interior/exterior/desktop. */
  inspectionType: string | null;
  /** Data sources consulted -- MLS, public records, etc. */
  dataSourcesConsulted: string[];
  /** Approaches to value developed. */
  approachesDeveloped: string[];
  /** Research scope / market area defined. */
  marketAreaDefined: string | null;
  /** Type of appraisal report: self-contained, summary, restricted. */
  reportType: string | null;
  /** Overall scope narrative. */
  scopeNarrative: string | null;
  /** Significant real property appraisal assistance. */
  significantAssistance: string | null;
}

// -----------------------------------------------------------------------
// ASSIGNMENT CONDITIONS  (Phase 6B -- URAR v1.3 Section 7)
// -----------------------------------------------------------------------

/** Assignment-level conditions, assumptions, and intended-use metadata. */
export interface CanonicalAssignmentConditions {
  /** Intended use of the appraisal. */
  intendedUse: string | null;
  /** Intended user(s) of the appraisal. */
  intendedUsers: string | null;
  /** Extraordinary assumptions for this assignment. */
  extraordinaryAssumptions: string[];
  /** Hypothetical conditions for this assignment. */
  hypotheticalConditions: string[];
  /** Subject-to conditions (e.g., subject to repairs, completion). */
  subjectToConditions: string[];
  /** Jurisdictional exceptions. */
  jurisdictionalExceptions: string[];
  /** Definition of market value used. */
  marketValueDefinition: string | null;
  /** Source of the market value definition. */
  marketValueDefinitionSource: string | null;
  /** Property rights appraised: fee simple, leased fee, etc. */
  propertyRightsAppraised: string | null;
}

// -----------------------------------------------------------------------
// ADDITIONAL COMMENTS  (Phase 6B -- URAR v1.3 Section 10)
// -----------------------------------------------------------------------

/** A structured additional-comment block referencing a specific section. */
export interface CanonicalAdditionalComment {
  /** Section reference -- which form section this comment pertains to. */
  sectionRef: string | null;
  /** Title / heading for this comment block. */
  heading: string;
  /** Comment body -- narrative text. */
  body: string;
}

// ===============================================================================
// PHASE 7A: NEW URAR v1.3 SECTION INTERFACES
// ===============================================================================

// -- 7A-1: Disaster Mitigation (URAR Page 9) ---------------------------------

/** A single disaster mitigation feature/action. */
export interface CanonicalDisasterMitigationItem {
  /** Category of disaster (e.g. Flood, Wildfire, Wind, Earthquake, Hail). */
  disasterCategory: string;
  /** Specific mitigation feature or action taken. */
  mitigationFeature: string;
  /** Additional detail about the mitigation. */
  detail: string | null;
}

/** Disaster mitigation section data -- URAR v1.3 page 9. */
export interface CanonicalDisasterMitigation {
  /** Individual mitigation features/actions. */
  items: CanonicalDisasterMitigationItem[];
  /** Community-level programs (FEMA CRS, Firewise, StormReady, etc.). */
  communityPrograms: string | null;
  /** Narrative commentary on disaster mitigation. */
  narrative: string | null;
}

// -- 7A-2: Energy Efficient & Green Features (URAR Page 10) -------------------

/** A single energy-efficient or green feature. */
export interface CanonicalEnergyFeature {
  /** Feature name (e.g. Solar Panels, Insulation Upgrade, Energy Star Appliances). */
  feature: string;
  /** Additional description. */
  detail: string | null;
  /** Estimated market impact (e.g. Beneficial, Neutral, Adverse). */
  impact: string | null;
}

/** Energy efficiency & green features section -- URAR v1.3 page 10. */
export interface CanonicalEnergyEfficiency {
  /** Individual energy/green features. */
  features: CanonicalEnergyFeature[];
  /** Renewable energy components (solar, wind, geothermal, etc.). */
  renewableEnergyComponent: string | null;
  /** Building certification (LEED, Energy Star, HERS, etc.). */
  buildingCertification: string | null;
  /** Numeric energy efficiency rating (e.g. HERS index). */
  energyEfficiencyRating: number | null;
  /** Narrative commentary. */
  narrative: string | null;
}

// -- 7A-3: Manufactured Home (URAR Page 13) -----------------------------------

/** Manufactured home details -- URAR v1.3 page 13. */
export interface CanonicalManufacturedHome {
  /** Whether a HUD data plate is present. */
  hudDataPlatePresent: boolean | null;
  /** HUD label number(s). */
  hudLabelNumbers: string | null;
  /** Manufacturer name. */
  manufacturer: string | null;
  /** Model name/number. */
  model: string | null;
  /** Serial number. */
  serialNumber: string | null;
  /** Year manufactured. */
  yearManufactured: number | null;
  /** Width type (Single-Wide, Double-Wide, Triple-Wide). */
  widthType: string | null;
  /** Invoice cost at time of purchase. */
  invoiceCost: number | null;
  /** Delivery cost. */
  deliveryCost: number | null;
  /** Installation cost. */
  installationCost: number | null;
  /** Setup cost. */
  setupCost: number | null;
  /** Foundation type for the manufactured home. */
  foundationType: string | null;
  /** Factory-built certification type if applicable. */
  factoryBuiltCertification: string | null;
  /** Narrative commentary. */
  narrative: string | null;
}

// -- 7A-4: Functional Obsolescence (URAR Page 15) ----------------------------

/** A single functional obsolescence item. */
export interface CanonicalFunctionalObsolescenceItem {
  /** The feature exhibiting obsolescence. */
  feature: string;
  /** Description of the obsolescence. */
  description: string | null;
  /** Whether the obsolescence is curable. */
  curable: boolean | null;
  /** Additional detail or explanation. */
  detail: string | null;
  /** Market impact (dollar amount or descriptive). */
  impact: string | null;
  /** Appraiser comment. */
  comment: string | null;
}

// -- 7A-5: Outbuilding (URAR Page 16) ----------------------------------------

/** A single outbuilding feature (e.g. workshop bench, plumbing fixture). */
export interface CanonicalOutbuildingFeature {
  /** Feature name. */
  feature: string;
  /** Description. */
  detail: string | null;
}

/** A single outbuilding on the property. */
export interface CanonicalOutbuilding {
  /** Type (e.g. Barn, Shed, Workshop, Greenhouse, Pool House, Guest House). */
  type: string;
  /** Gross building area (sq ft). */
  gba: number | null;
  /** Finished area (sq ft). */
  finishedArea: number | null;
  /** Unfinished area (sq ft). */
  unfinishedArea: number | null;
  /** Volume (cubic ft) -- for volumetric measuring. */
  volume: number | null;
  /** Number of bathrooms. */
  baths: number | null;
  /** Number of kitchens. */
  kitchens: number | null;
  /** HVAC description. */
  hvac: string | null;
  /** Utilities (electric, water, sewer). */
  utilities: string | null;
  /** Year built. */
  yearBuilt: number | null;
  /** Quality rating (Q1-Q6). */
  quality: string | null;
  /** Condition rating (C1-C6). */
  condition: string | null;
  /** Additional features. */
  features: CanonicalOutbuildingFeature[];
  /** Narrative comment. */
  comment: string | null;
}

// -- 7A-6: Vehicle Storage (URAR Page 17) ------------------------------------

/** A single vehicle storage structure. */
export interface CanonicalVehicleStorage {
  /** Type: Attached Garage, Detached Garage, Built-In Garage, Carport, None. */
  type: string;
  /** Number of vehicle spaces. */
  spaces: number | null;
  /** Additional detail (finish, door type, etc.). */
  detail: string | null;
  /** Market impact. */
  impact: string | null;
  /** Year built (may differ from main dwelling). */
  yearBuilt: number | null;
  /** Surface area (sq ft). */
  surfaceArea: number | null;
  /** Whether there is interior storage beyond vehicle parking. */
  interiorStorage: boolean | null;
}

// -- 7A-7: Subject Property Amenities (URAR Page 18) -------------------------

/** A single property amenity. */
export interface CanonicalPropertyAmenity {
  /** Category: Outdoor Accessories, Outdoor Living, Water Features, Whole Home, Miscellaneous. */
  category: string;
  /** Feature name (e.g. Patio, Pool, Deck, Fireplace, Fencing). */
  feature: string;
  /** Additional detail. */
  detail: string | null;
  /** Market impact (Beneficial, Neutral, Adverse). */
  impact: string | null;
  /** Appraiser comment. */
  comment: string | null;
}

// -- 7A-8: Overall Quality & Condition (URAR Page 19) ------------------------

/** Quality and condition rating for a specific building feature. */
export interface CanonicalFeatureQC {
  /** Feature name (e.g. Walls, Foundation, Roof, Windows, Kitchen, Bathrooms, Flooring). */
  feature: string;
  /** Quality rating (Q1-Q6). */
  quality: string | null;
  /** Condition rating (C1-C6). */
  condition: string | null;
}

/** Overall quality & condition assessment -- URAR v1.3 page 19. */
export interface CanonicalOverallQualityCondition {
  /** Overall quality rating (Q1-Q6). */
  overallQuality: string | null;
  /** Overall condition rating (C1-C6). */
  overallCondition: string | null;
  /** Per-feature exterior ratings (Walls, Foundation, Roof, Windows). */
  exteriorFeatures: CanonicalFeatureQC[];
  /** Per-feature interior ratings (Kitchen, Bathrooms, Flooring, Walls/Trim/Finish). */
  interiorFeatures: CanonicalFeatureQC[];
  /** Reconciliation narrative explaining Q/C ratings. */
  reconciliationNarrative: string | null;
}

// -- 7A-9: Subject Listing Information (URAR Page 23) ------------------------

/** A single listing record for subject property listing history. */
export interface CanonicalSubjectListing {
  /** Data source (MLS name, public records, etc.). */
  dataSource: string | null;
  /** Listing status (Active, Pending, Sold, Withdrawn, Expired, Cancelled). */
  listingStatus: string | null;
  /** Listing type (Original, Relisted, Price Change). */
  listingType: string | null;
  /** MLS or listing ID number. */
  listingId: string | null;
  /** Listing start date (ISO string). */
  startDate: string | null;
  /** Listing end date (ISO string). */
  endDate: string | null;
  /** Days on market for this listing period. */
  daysOnMarket: number | null;
  /** Starting list price. */
  startingListPrice: number | null;
  /** Current or final list price. */
  currentOrFinalListPrice: number | null;
}

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
  /** FK → PropertyRecord — the physical subject property. Added Phase R0.3. */
  propertyId?: string;
  /** FK → Engagement that produced this report. Added Phase R0.3. */
  engagementId?: string;
  reportType: string; // "1004", "1073", "2055", etc.
  status: string;
  schemaVersion: string; // must equal SCHEMA_VERSION

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
  /** Addenda content — scope of work, assumptions, conditions, free-form pages. */
  addenda?: CanonicalAddenda;
  // --- Phase 0.2: Value types & effective dates ---
  /** All value types requested for this assignment. */
  valueTypes?: ValueType[];
  /** Per-value-type effective dates (e.g. AS_IS -> inspection date, PROSPECTIVE -> completion date). */
  effectiveDates?: Partial<Record<ValueType, string>>;
  // -- Phase 6B: New core sections -------------------------------------------
  /** Prior transfer/sale history for subject and comps -- URAR v1.3 section 5. */
  priorTransfers?: CanonicalPriorTransfer[];
  /** Scope of work details -- URAR v1.3 section 6 / USPAP SR2. */
  scopeOfWork?: CanonicalScopeOfWork;
  /** Assignment conditions -- extraordinary assumptions, hypothetical conditions, etc. */
  assignmentConditions?: CanonicalAssignmentConditions;
  /** Additional structured comments by section -- URAR v1.3 section 10. */
  additionalComments?: CanonicalAdditionalComment[];
  // -- Phase 7A: New URAR v1.3 sections -------------------------------------
  /** Disaster mitigation features -- URAR v1.3 page 9. */
  disasterMitigation?: CanonicalDisasterMitigation;
  /** Energy efficient & green features -- URAR v1.3 page 10. */
  energyEfficiency?: CanonicalEnergyEfficiency;
  /** Manufactured home details -- URAR v1.3 page 13. Populated when propertyType is Manufactured. */
  manufacturedHome?: CanonicalManufacturedHome;
  /** Functional obsolescence items -- URAR v1.3 page 15. */
  functionalObsolescence?: CanonicalFunctionalObsolescenceItem[];
  /** Outbuildings on the property -- URAR v1.3 page 16. */
  outbuildings?: CanonicalOutbuilding[];
  /** Vehicle storage structures -- URAR v1.3 page 17. */
  vehicleStorage?: CanonicalVehicleStorage[];
  /** Property amenities -- URAR v1.3 page 18. */
  amenities?: CanonicalPropertyAmenity[];
  /** Overall quality & condition assessment -- URAR v1.3 page 19. */
  overallQualityCondition?: CanonicalOverallQualityCondition;
  /** Subject listing history -- URAR v1.3 page 23. */
  subjectListings?: CanonicalSubjectListing[];
  /** Total days on market across all listing periods. */
  totalDaysOnMarket?: number | null;
  /** Listing history analysis narrative. */
  listingHistoryAnalysis?: string | null;
  /** Defects, damages & deficiencies -- URAR v1.3 pages 4, 37. */
  defects?: CanonicalDefectItem[];
  /** As-is overall condition rating. */
  asIsOverallConditionRating?: string | null;
  /** Total estimated cost of all identified repairs. */
  totalEstimatedCostOfRepairs?: number | null;
  // -- End Phase 7A ----------------------------------------------------------
  // -- Phase 7C: Analyzed properties not used --------------------------------
  /** Properties analyzed but not selected as comparables -- URAR v1.3 Pages 29-30. */
  analyzedPropertiesNotUsed?: CanonicalAnalyzedPropertyNotUsed[];
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

export interface CanonicalReconciliation {
  salesCompApproachValue: number | null;
  costApproachValue: number | null;
  incomeApproachValue: number | null;
  /** The appraiser's final opinion of value. */
  finalOpinionOfValue: number;
  /** ISO date string — the "as of" effective date. */
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
  // ── Reviewer override fields (Phase UI) ────────────────────────────────────
  /** Reviewer's override for the as-repaired value (distinct from appraiser's as-repaired). */
  reviewerAsRepairedValue?: number | null;
  /** Reviewer's repair estimate override. */
  reviewerRepairEstimate?: number | null;
  /** Fair market monthly rent opinion (income approach). */
  fairMarketMonthlyRent?: number | null;

  // ── Phase 7B-8 expansion ──────────────────────────────────────────────
  /** Reason for excluding or discounting the sales comparison approach. */
  salesCompReasonForExclusion?: string | null;
  /** Reason for excluding or discounting the cost approach. */
  costReasonForExclusion?: string | null;
  /** Reason for excluding or discounting the income approach. */
  incomeReasonForExclusion?: string | null;
  /** Opinion of market value of cooperative interest (co-op only). */
  cooperativeInterestValue?: number | null;
  /** Pro-rata share calculation method for co-op. */
  proRataShareCalculationMethod?: string | null;
  /** Market value condition: as-is, as-completed, as-repaired, subject-to, etc. */
  marketValueCondition?: 'as-is' | 'as-completed' | 'as-repaired' | 'subject-to-completion' | 'subject-to-alteration' | string | null;
  /** FHA REO insurability level. */
  fhaReoInsurabilityLevel?: string | null;
  /** Final value condition narrative statement. */
  finalValueConditionStatement?: string | null;
  /** Date of property inspection (ISO-8601). */
  dateOfInspection?: string | null;
  /** Client-requested value condition. */
  clientRequestedValueCondition?: string | null;
  /** Client-requested marketing time. */
  clientRequestedMarketingTime?: string | null;
  /** Client-requested duration / term. */
  clientRequestedDuration?: string | null;
  /** Alternate opinion requested by client. */
  clientAlternateOpinion?: string | null;
  /** Client-requested conditions commentary. */
  clientConditionsCommentary?: string | null;
}

export interface CanonicalAppraiserInfo {
  name: string;
  licenseNumber: string;
  licenseState: string;
  licenseType: 'Certified Residential' | 'Certified General' | 'Licensed' | 'Trainee';
  licenseExpirationDate: string;
  companyName: string;
  companyAddress: string;
  phone: string;
  email: string;
  signatureDate: string;
  supervisoryAppraiser?: Omit<CanonicalAppraiserInfo, 'supervisoryAppraiser'>;

  // -- Phase 7B-9: Certification Expansion --------------------------------

  /** Date the subject property was inspected (YYYY-MM-DD). */
  inspectionDate?: string | null;
  /** Type of property inspection performed. */
  inspectionType?: 'Interior' | 'Exterior' | 'Desktop' | 'Drive-By' | null;
  /** Did the appraiser personally inspect the interior? */
  didInspectInterior?: boolean | null;
  /** Did the appraiser personally inspect the exterior? */
  didInspectExterior?: boolean | null;
  /** Description of how property was inspected (e.g. "from the street"). */
  propertyInspectedFrom?: string | null;
  /** GLA measured in compliance with ANSI Z765 standard. */
  ansiCompliant?: boolean | null;
  /** Name(s) of individuals who provided significant real property appraisal assistance. */
  significantAssistance?: string | null;
  /** Professional designations (MAI, SRA, AI-RRS, etc.). */
  designations?: string | null;
  /** NRDS / Appraisal Institute membership ID. */
  nrdsId?: string | null;
  /** FHA case number, when applicable. */
  fhaCaseNumber?: string | null;
  /** Effective date of the value opinion (YYYY-MM-DD). */
  effectiveDate?: string | null;
  /** Disclosure of prior services regarding the subject property within 3 years. */
  priorServicesDisclosure?: string | null;
  /** Compliance frameworks applied (FIRREA, USPAP edition year, etc.). */
  appraisalCompliance?: string | null;
}

export interface DvrSubjectDetail {
  overallCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  interiorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  exteriorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  estimatedRepairCostLow: number | null;
  estimatedRepairCostHigh: number | null;
  majorRepairsNeeded: string | null;
  occupancyStatus: 'Owner Occupied' | 'Tenant Occupied' | 'Vacant' | 'Unknown';
  occupantCooperation: 'Cooperative' | 'Uncooperative' | 'No Contact' | null;
  accessType: 'Interior' | 'Exterior Only' | 'Drive-By';
  daysToSell: number | null;
  listingPriceRecommendation: number | null;
  quickSaleDiscount: number | null;
}

// ── Phase 7B-7: Cost Approach Supporting Interfaces ─────────────────────────

/** Per-structure cost and depreciation breakdown for cost approach. */
export interface CanonicalCostStructure {
  structureName: string;
  structureType?: string | null;
  grossBuildingArea?: number | null;
  replacementCostNew?: number | null;
  physicalDepreciation?: number | null;
  functionalObsolescence?: number | null;
  externalObsolescence?: number | null;
  totalDepreciation?: number | null;
  depreciatedCost?: number | null;
  remainingEconomicLife?: number | null;
  effectiveAge?: number | null;
  economicLife?: number | null;
}

/** Itemized site improvement for cost approach. */
export interface CanonicalCostSiteImprovement {
  description: string;
  cost?: number | null;
  depreciatedCost?: number | null;
  remainingLife?: number | null;
}

/** Structured land sale comparable. */
export interface CanonicalLandComparable {
  address?: string | null;
  saleDate?: string | null;
  salePrice?: number | null;
  siteSize?: number | null;
  siteSizeUnit?: 'sqft' | 'acres' | null;
  pricePerUnit?: number | null;
  zoningClassification?: string | null;
  adjustedPrice?: number | null;
  dataSource?: string | null;
  proximityToSubject?: string | null;
}

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

  // ── Phase 7B-7 expansion ──────────────────────────────────────────────
  /** Replacement vs. Reproduction. */
  costType?: 'Replacement' | 'Reproduction' | null;
  /** Cost method: Comparative Unit, Segregated Cost, Quantity Survey, etc. */
  costMethod?: string | null;
  /** Depreciation method (expanded from depreciationType). */
  depreciationMethod?: string | null;
  /** Remaining economic life at the top level. */
  remainingEconomicLife?: number | null;
  /** Per-structure cost + depreciation breakdowns. */
  structures?: CanonicalCostStructure[];
  /** Itemized site improvements table. */
  siteImprovements?: CanonicalCostSiteImprovement[];
  /** Land sale comparables table. */
  landComparables?: CanonicalLandComparable[];
  /** Narrative: why replacement vs. reproduction was chosen. */
  costMethodologyNarrative?: string | null;
  /** Narrative: depreciation methodology explanation. */
  depreciationNarrative?: string | null;
  /** Narrative: detailed land value analysis. */
  landValueNarrative?: string | null;
  /** Manufactured home delivery cost (for cost approach calc). */
  manufacturedHomeDeliveryCost?: number | null;
  /** Manufactured home installation cost. */
  manufacturedHomeInstallationCost?: number | null;
  /** Manufactured home setup cost. */
  manufacturedHomeSetupCost?: number | null;
}

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

export interface ReportPhotoAsset {
  orderId: string;
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
  compIndex?: number;
  caption?: string;
  takenAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDENDA  (Phase 4 — UAD 3.6 Compliance)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Addenda content appended to the URAR report.
 * Each entry represents a separate addendum page / section.
 */
export interface CanonicalAddenda {
  /** Scope of work narrative — required by USPAP. */
  scopeOfWork: string | null;
  /** Extraordinary assumptions (mirrored from reconciliation for convenience). */
  extraordinaryAssumptions: string[];
  /** Hypothetical conditions (mirrored from reconciliation for convenience). */
  hypotheticalConditions: string[];
  /** Free-form addendum pages — each entry is one page of narrative. */
  additionalPages: AddendumPage[];
}

export interface AddendumPage {
  /** Page title / heading. */
  title: string;
  /** Rich-text or plain-text content. */
  content: string;
}
