/**
 * Canonical Report Schema — v1.0.0
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
 * @see URAR Form 1004 section references in JSDoc comments.
 * @see current-plan/CANONICAL_SCHEMA_PLAN.md for migration plan.
 */

export const SCHEMA_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR RAW STORAGE  (Cosmos container: vendor-data)
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL ADDRESS
// ═══════════════════════════════════════════════════════════════════════════════

/** URAR: Subject Section — Property Address block. */
export interface CanonicalAddress {
  streetAddress: string;
  unit: string | null;
  city: string;
  state: string; // 2-letter code
  zipCode: string; // 5-digit
  county: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL PROPERTY CORE  (shared fields for Subject + Comps)
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ── Size & Layout (URAR: Improvements) ────────────────────────────────────
  /** Above-grade living area in square feet. FNMA standard name. */
  grossLivingArea: number;
  totalRooms: number;
  bedrooms: number;
  bathrooms: number; // full + half × 0.5
  stories: number;

  // ── Site (URAR: Site section) ─────────────────────────────────────────────
  lotSizeSqFt: number;
  propertyType: string; // SFR, Condo, Townhouse, PUD, etc.

  // ── Quality & Condition (UAD C1-C6 / Q1-Q6) ──────────────────────────────
  condition: string; // C1-C6
  quality: string; // Q1-Q6

  // ── Design & Construction (URAR: Improvements) ───────────────────────────
  design: string; // e.g. "Colonial", "Ranch", "Contemporary"
  yearBuilt: number;
  foundationType: string; // "Full Basement", "Crawl Space", "Slab", "Pier"
  exteriorWalls: string; // "Brick", "Vinyl Siding", "Wood", "Stucco"
  roofSurface: string; // "Asphalt Shingle", "Metal", "Tile"

  // ── Basement (URAR: Improvements — Below Grade) ──────────────────────────
  basement: string; // "Full", "Partial", "None"
  basementFinishedSqFt: number | null;

  // ── Heating / Cooling / Energy (URAR: Improvements) ──────────────────────
  heating: string; // "FWA", "HWBB", "Radiant", "Other", "None"
  cooling: string; // "Central", "Wall Unit", "None"
  fireplaces: number;

  // ── Garage / Carport (URAR: Improvements) ─────────────────────────────────
  garageType: string; // "Attached", "Detached", "Built-In", "Carport", "None"
  garageSpaces: number;

  // ── Other Improvements (URAR: Improvements) ──────────────────────────────
  porchPatioDeck: string; // description, e.g. "Open Porch, Deck"
  pool: boolean;
  attic: string; // "None", "Scuttle", "Stairs", "Finished"

  // ── View & Location (UAD View / Location ratings) ─────────────────────────
  view: string; // UAD view rating or description
  locationRating: string; // "Beneficial" | "Neutral" | "Adverse"

  // ── Geolocation ───────────────────────────────────────────────────────────
  latitude: number | null;
  longitude: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL SUBJECT PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The appraised property.
 *
 * URAR: Subject Section (page 1, top half)
 *       + Site Section
 *       + Improvements Section
 */
export interface CanonicalSubject extends CanonicalPropertyCore {
  // ── Identification (URAR: Subject) ────────────────────────────────────────
  parcelNumber: string | null; // APN / Assessor's Parcel Number
  censusTract: string | null;
  mapReference: string | null; // tax map / plat reference
  currentOwner: string | null;
  occupant: 'Owner' | 'Tenant' | 'Vacant' | null;

  // ── Legal (URAR: Subject) ─────────────────────────────────────────────────
  legalDescription: string | null;

  // ── Zoning (URAR: Site) ───────────────────────────────────────────────────
  zoning: string | null; // classification code
  zoningCompliance: 'Legal' | 'LegalNonConforming' | 'Illegal' | null;
  highestAndBestUse: 'Present' | 'Other' | null;

  // ── Flood (URAR: Site) ────────────────────────────────────────────────────
  floodZone: string | null; // e.g. "X", "A", "AE"
  floodMapNumber: string | null;
  floodMapDate: string | null; // ISO date

  // ── Utilities (URAR: Site) ────────────────────────────────────────────────
  utilities: CanonicalUtilities | null;

  // ── Neighborhood (URAR: Neighborhood section, page 1) ────────────────────
  neighborhood: CanonicalNeighborhood | null;

  // ── Contract (URAR: Contract section, page 1) ────────────────────────────
  contractInfo: CanonicalContractInfo | null;

  // ── Market trend (supplemental) ───────────────────────────────────────────
  hpiTrend: 'Increasing' | 'Stable' | 'Declining' | null;
}

/** URAR: Site — Utilities row. */
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

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL COMPARABLE PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A comparable property — either a selected comp (on the URAR grid)
 * or a candidate (available for selection but not yet placed).
 *
 * URAR: Sales Comparison Approach grid (page 2)
 */
export interface CanonicalComp extends CanonicalPropertyCore {
  compId: string; // stable unique ID

  // ── Sale Information (URAR: Sale grid columns) ────────────────────────────
  salePrice: number | null;
  saleDate: string | null; // ISO date
  priorSalePrice: number | null;
  priorSaleDate: string | null; // ISO date
  listPrice: number | null;
  financingType: string | null; // "Conventional", "FHA", "VA", "Cash", etc.
  saleType: string | null; // "ArmLength", "REO", "ShortSale", etc.
  concessionsAmount: number | null;

  // ── Source Tracking ────────────────────────────────────────────────────────
  dataSource: 'mls' | 'public_record' | 'avm' | 'manual';
  vendorId: string; // which vendor provided this comp
  vendorRecordRef: string | null; // ID into vendor-data container for traceability

  // ── Distance & Proximity (URAR: proximity column) ────────────────────────
  distanceFromSubjectMiles: number;
  proximityScore: number | null; // 0-100 if vendor-computed

  // ── Selection State (workspace UI) ────────────────────────────────────────
  /** true = appraiser has selected this comp for the grid. */
  selected: boolean;
  /** 1-6 grid slot if selected; null if candidate. */
  slotIndex: number | null;

  // ── Adjustments (URAR: adjustment grid — populated for selected comps) ───
  adjustments: CanonicalAdjustments | null;

  // ── Extension Data (non-UAD enrichment from source) ───────────────────────
  mlsData: MlsExtension | null;
  publicRecordData: PublicRecordExtension | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL ADJUSTMENTS  (FNMA 1004 Sales Comparison Grid)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Line-item adjustments matching the URAR / FNMA 1004 adjustment grid.
 * All values are dollar amounts (positive = comp inferior, negative = comp superior).
 *
 * URAR: Page 2, Sales Comparison Approach grid rows.
 */
export interface CanonicalAdjustments {
  // ── Transactional Adjustments ─────────────────────────────────────────────
  saleOrFinancingConcessions: number;
  dateOfSaleTime: number;

  // ── Location Adjustments ──────────────────────────────────────────────────
  locationAdj: number;
  leaseholdFeeSimple: number;
  site: number;
  viewAdj: number;

  // ── Physical Adjustments ──────────────────────────────────────────────────
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

  // ── Other ─────────────────────────────────────────────────────────────────
  otherAdj1: number;
  otherAdj2: number;
  otherAdj3: number;

  // ── Computed Totals ───────────────────────────────────────────────────────
  /** Sum of all adjustments (preserving sign). */
  netAdjustmentTotal: number;
  /** Sum of absolute values of all adjustments. */
  grossAdjustmentTotal: number;
  /** salePrice + netAdjustmentTotal. */
  adjustedSalePrice: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENSION INTERFACES  (non-UAD enrichment data)
// ═══════════════════════════════════════════════════════════════════════════════

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
  taxYear: number | null;
  annualTaxAmount: number | null;
  legalDescription: string | null;
  zoning: string | null;
  deedTransferDate: string | null;
  deedTransferAmount: number | null;
  ownerName: string | null;
  landUseCode: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL VALUATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * URAR: Reconciliation section (page 2 bottom / page 3 top).
 * The appraiser's final value opinion.
 */
export interface CanonicalValuation {
  estimatedValue: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number | null; // 0-100
  effectiveDate: string; // ISO date — the "as of" date
  reconciliationNotes: string | null;
  approachesUsed: ('sales_comparison' | 'cost' | 'income')[];
  avmProvider: string | null;
  avmModelVersion: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP-LEVEL REPORT DOCUMENT  (Cosmos container: reporting)
// ═══════════════════════════════════════════════════════════════════════════════

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

  /** URAR: Subject section (page 1). */
  subject: CanonicalSubject;

  /** URAR: Sales Comparison grid (page 2). All comps — candidates + selected. */
  comps: CanonicalComp[];

  /** URAR: Reconciliation (page 2-3). Null until valuation is run. */
  valuation: CanonicalValuation | null;

  // ── Metadata ──────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPER INTERFACE  (implemented per vendor)
// ═══════════════════════════════════════════════════════════════════════════════

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
