/**
 * Short-Term Rental (STR) Feasibility Report — Type Definitions
 *
 * A lender-ordered addendum that quantifies a property's STR income potential
 * using multiple data sources (AirROI, AirDNA, Airbnb comps) and documents
 * local regulatory requirements.  Not an appraisal; USPAP ethical obligations
 * apply but appraisal development/reporting standards do not.
 *
 * PDF reference: "STR for HomeXpress.pdf" (completed 4/27/2026, St. Pete Beach)
 */

// =============================================================================
// ENUMS / UNIONS
// =============================================================================

/** Which external platforms provided data for this analysis */
export type StrDataSourceName = 'AirROI' | 'AirDNA' | 'InsideAirbnb' | 'Airbnb' | 'Rabbu' | 'VRBO' | 'Manual';

/** Lifecycle state of an STR feasibility order */
export type StrFeasibilityStatus =
  | 'DRAFT'
  | 'DATA_COLLECTION'
  | 'ANALYST_REVIEW'
  | 'COMPLETE'
  | 'CANCELLED';

/** Property design/appeal classification matching typical STR comp descriptions */
export type PropertyDesign =
  | 'Bungalow'
  | 'Townhouse'
  | 'Condo'
  | 'Single Family'
  | 'Multi-Family'
  | 'Cabin'
  | 'Cottage'
  | 'Villa'
  | 'Other';

// =============================================================================
// DATA SOURCE PROJECTIONS
// =============================================================================

/**
 * Revenue / occupancy projection from a single external data source.
 * Multiple sources are presented side-by-side; the analyst notes which
 * was used as the primary basis and why (see `primarySourceName` on the order).
 */
export interface StrProjection {
  sourceName: StrDataSourceName;
  /** Projected gross annual revenue ($/yr) */
  projectedAnnualRevenue: number;
  /** Average occupancy rate expressed as a decimal, e.g. 0.55 = 55% */
  occupancyRate: number;
  /** Average daily rate in USD */
  averageDailyRate: number;
  /** Month names of high-demand season, e.g. ["March","April","May"] */
  highSeasonMonths: string[];
  /** Month names of low-demand season */
  lowSeasonMonths: string[];
  /** Estimated annual operating expenses (management, cleaning, supplies, etc.) */
  annualOperatingExpenses: number;
  /** Net operating income = revenue − expenses */
  estimatedNOI: number;
  /** Free-text note from analyst about this source's reliability */
  analystNote?: string;
  retrievedAt: string; // ISO-8601
}

// =============================================================================
// COMPARABLE RENTALS
// =============================================================================

/**
 * A comparable active STR listing used to bracket the subject.
 * Addresses are NOT masked — this codebase stores full addresses.
 */
export interface StrComparable {
  /** Sequential number shown on the report (1, 2, 3…) */
  compNumber: number;
  /** Listing name from the platform (e.g. "Seaside Solitude") */
  listingName?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  /** Straight-line distance from subject in miles */
  distanceFromSubjectMiles: number;
  dataSource: StrDataSourceName;
  platformListingId?: string;     // Airbnb, AirDNA, Rabbu listing ID
  platformListingUrl?: string;

  // — Physical characteristics —
  bedrooms: number;
  bathrooms: number;
  maxGuests?: number;
  squareFeet?: number;
  yearBuilt?: number;
  design?: PropertyDesign;
  amenities: string[];            // e.g. ["Pool", "Hot tub", "Ocean view"]

  // — STR performance metrics —
  averageDailyRate: number;
  /** Occupancy rate as a decimal, e.g. 0.63 */
  occupancyRate: number;
  estimatedMonthlyRevenue: number;
  cleaningFee?: number;
  managementFeePercent?: number;  // e.g. 0.20 = 20%

  proximityDescription?: string;  // "Walking distance to beach/bay"
  analystNote?: string;
}

// =============================================================================
// REGULATORY PROFILE
// =============================================================================

/**
 * Jurisdiction-level STR rules.  Seeded per city/county; looked up at report
 * generation time based on subject property jurisdiction.
 */
export interface StrRegulatoryProfile {
  /** Cosmos document id — typically "{state}-{county}-{city}" kebab-case */
  id: string;
  state: string;
  county: string;
  city: string;
  /** e.g. "Pinellas County, FL" */
  jurisdictionDisplayName: string;

  // — Restrictions —
  /**
   * If true, the city explicitly prohibits STRs in residential zones.
   * Report must call this out prominently.
   */
  strProhibited: boolean;
  /** Maximum number of short-term rentals per rolling 365-day period. null = unlimited */
  maxRentalsPerYear: number | null;
  /** Minimum rental duration in days (null = no minimum) */
  minimumRentalDays: number | null;
  /** Maximum rental duration that qualifies as "short-term" */
  maxShortTermDays: number;

  // — Licensing & fees —
  requiresBusinessTaxReceipt: boolean;
  requiresDBPRVacationRentalLicense: boolean;
  requiresCertificateOfUse: boolean;
  certificateOfUseFee?: number;     // USD
  certificateOfUseInspectionFee?: number; // USD
  requiresReinspectionEveryYears?: number;

  // — Occupancy limits —
  maxOccupantsFormula: string;      // e.g. "2 per bedroom + 2 additional, max 10"
  absoluteMaxOccupants?: number;

  // — Tax obligations —
  /** Combined state + county lodging tax rate as a decimal, e.g. 0.13 = 13% */
  totalLodgingTaxRate: number;
  stateSalesTaxRate?: number;
  countyTouristDevelopmentTaxRate?: number;

  // — Enforcement —
  activeEnforcement: boolean;
  enforcementNotes?: string;

  /** Plain-text summary suitable for report narrative */
  complianceSummaryText: string;

  /** ISO-8601 date this record was last verified */
  lastVerifiedAt: string;
  sourceUrl?: string;
}

// =============================================================================
// ORDER DOCUMENT
// =============================================================================

/**
 * The primary Cosmos document for an STR Feasibility order.
 * Stored in the same container as other order types; discriminated by productType = 'STR_FEASIBILITY'.
 */
export interface StrFeasibilityOrder {
  id: string;               // Cosmos document id
  productType: 'STR_FEASIBILITY';
  status: StrFeasibilityStatus;

  // — Linkage —
  tenantId: string;
  engagementId?: string;
  clientOrderId?: string;
  /** Ordering lender / client name */
  clientName?: string;
  /** Borrower name for the loan file */
  borrowerName?: string;
  /** Lender's loan number */
  lenderLoanNumber?: string;
  /** This platform's order number */
  orderNumber?: string;

  // — Subject property —
  subjectAddress: string;
  subjectCity: string;
  subjectState: string;
  subjectPostalCode: string;
  subjectLatitude?: number;
  subjectLongitude?: number;
  subjectBedrooms: number;
  subjectBathrooms: number;
  subjectSquareFeet?: number;
  subjectYearBuilt?: number;
  subjectPropertyType?: string;     // "SFR", "Condo", "Townhouse", etc.
  subjectDesign?: PropertyDesign;
  subjectAmenities?: string[];
  subjectProximityDescription?: string; // e.g. "Walking distance to beach"
  subjectAssociationName?: string;

  // — Analysis inputs —
  /** Which sources to query (drives service orchestration) */
  requestedDataSources: StrDataSourceName[];
  /** Search radius for comps (miles) */
  compSearchRadiusMiles: number;
  /** How many comps to target */
  targetCompCount: number;

  // — Results —
  projections: StrProjection[];
  /** Name of the source the analyst designated as primary/most reliable */
  primarySourceName?: StrDataSourceName;
  /** The projection from the primary source, resolved for quick access */
  primaryProjection?: StrProjection;
  comparables: StrComparable[];
  regulatoryProfile?: StrRegulatoryProfile;

  // — Narrative sections —
  subjectAndMarketDescription?: string;
  purposeStatement?: string;
  keyAssumptions?: string[];
  justificationForStrIncome?: string;
  disclosureText?: string;
  uspapComplianceStatement?: string;

  // — Report delivery —
  /** Cosmos document id of the generated PDF/HTML report */
  reportDocumentId?: string;
  /** Handlebars template used for report generation */
  reportTemplateKey?: string;
  /** Name and credentials of the analyst who completed the report */
  completedByName?: string;
  completedByCredentials?: string;
  completedAt?: string; // ISO-8601

  createdAt: string;
  updatedAt: string;
  createdBy: string; // userId
}

// =============================================================================
// REQUEST / RESPONSE DTOs
// =============================================================================

export interface CreateStrFeasibilityRequest {
  engagementId?: string;
  clientOrderId?: string;
  clientName?: string;
  borrowerName?: string;
  lenderLoanNumber?: string;
  subjectAddress: string;
  subjectCity: string;
  subjectState: string;
  subjectPostalCode: string;
  subjectBedrooms: number;
  subjectBathrooms: number;
  subjectSquareFeet?: number;
  subjectYearBuilt?: number;
  subjectPropertyType?: string;
  requestedDataSources?: StrDataSourceName[];
  compSearchRadiusMiles?: number;
  targetCompCount?: number;
}

export interface UpdateStrFeasibilityRequest {
  status?: StrFeasibilityStatus;
  comparables?: StrComparable[];
  primarySourceName?: StrDataSourceName;
  subjectAndMarketDescription?: string;
  purposeStatement?: string;
  keyAssumptions?: string[];
  justificationForStrIncome?: string;
  completedByName?: string;
  completedByCredentials?: string;
}
