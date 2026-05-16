/**
 * Absorption Rate & Sellout Analysis — Type Definitions
 *
 * A lender/developer-ordered memorandum that projects the sellout timeline for
 * a new-construction or condo project using appraisal data, MLS comps, and
 * market context.  Not an appraisal; consistent with USPAP AO-34.
 *
 * PDF reference: "La Linda Surfside — Absorption Rate Analysis" (Vision VMC, 1/28/2026)
 */

// =============================================================================
// ENUMS / UNIONS
// =============================================================================

export type AbsorptionStudyStatus =
  | 'DRAFT'
  | 'DATA_COLLECTION'
  | 'ANALYST_REVIEW'
  | 'COMPLETE'
  | 'CANCELLED';

/** Scenario tier following the base/upside/downside convention in the sample PDF */
export type AbsorptionScenarioTier = 'BASE' | 'UPSIDE' | 'DOWNSIDE';

/** Project development stage at time of order */
export type ProjectStage =
  | 'PRE_CONSTRUCTION'
  | 'UNDER_CONSTRUCTION'
  | 'NEAR_COMPLETION'
  | 'COMPLETE';

// =============================================================================
// UNIT MIX
// =============================================================================

/**
 * A single row in the unit-mix table (grouping units by size/type).
 * Multiple UnitMixEntry rows make up the full project unit mix.
 */
export interface UnitMixEntry {
  unitType?: string;              // e.g. "Townhouse", "Penthouse", "Studio"
  squareFeet: number;
  unitCount: number;
  indicativePricePerSqFt?: number;
  indicativeUnitPrice?: number;   // Typically ppsf × sqft
  priceRange?: { min: number; max: number };
}

// =============================================================================
// MLS ABSORPTION COMPARABLE
// =============================================================================

/**
 * A comparable project or listing used to support the absorption conclusions.
 * Drawn from MLS / bridge data or the linked appraisal.
 */
export interface AbsorptionComparable {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  distanceFromSubjectMiles?: number;

  projectName?: string;
  unitCount: number;
  unitMix?: UnitMixEntry[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  pricePerSqFtMin?: number;
  pricePerSqFtMax?: number;

  totalSelloutValue?: number;
  presalePercent?: number;        // e.g. 0.50 = 50% presold before completion
  /** Months from market entry to last unit sold */
  totalSelloutMonths?: number;
  /** Months post-completion to absorb remaining inventory */
  postCompletionMonths?: number;
  averageDaysOnMarket?: number;

  dataSource: string;             // "MLS", "Appraisal", "Bridge Interactive", etc.
  mlsListingIds?: string[];
  saleDate?: string;              // ISO-8601 close date for comp transactions
  analystNote?: string;
}

// =============================================================================
// ABSORPTION SCENARIOS
// =============================================================================

/**
 * One sellout scenario (base, upside, or downside).
 */
export interface AbsorptionScenario {
  tier: AbsorptionScenarioTier;
  /** Label shown on the report, e.g. "Base Case" */
  label: string;
  description: string;

  /** Number of units assumed sold before/at project completion */
  presaleUnits: number;
  /** presaleUnits / totalUnits as a decimal */
  presalePercent: number;
  /** Units remaining after presales */
  remainingUnitsAtCompletion: number;
  /** Months post-completion to absorb remaining units */
  postCompletionMonths: number;
  /** Total months from market entry (presales + post-completion) */
  totalSelloutWindowMonths: number;
  /** e.g. "3–9 months per unit" */
  marketingTimePerUnit?: string;

  keyAssumptions: string[];
  riskFactors?: string[];
}

// =============================================================================
// ORDER DOCUMENT
// =============================================================================

/**
 * Primary Cosmos document for an Absorption Study order.
 * productType = 'ABSORPTION_STUDY'
 */
export interface AbsorptionStudyOrder {
  id: string;
  productType: 'ABSORPTION_STUDY';
  status: AbsorptionStudyStatus;

  // — Linkage —
  tenantId: string;
  engagementId?: string;
  clientOrderId?: string;
  /** Ordering lender / developer name */
  clientName?: string;
  /** Developer / owner name */
  developerName?: string;
  /** This platform's order number */
  orderNumber?: string;

  // — Project / subject property —
  projectName?: string;
  subjectAddress: string;
  subjectCity: string;
  subjectState: string;
  subjectPostalCode: string;
  subjectLatitude?: number;
  subjectLongitude?: number;

  // — Project characteristics —
  projectStage: ProjectStage;
  totalUnits: number;
  unitMix: UnitMixEntry[];
  indicativePricePerSqFt?: number;
  totalRetailSelloutValue?: number;
  /** Anticipated date construction will be complete (ISO-8601 date) */
  anticipatedCompletionDate?: string;

  // — Linked appraisal —
  /** OrderId of the associated full appraisal in the same engagement */
  linkedAppraisalOrderId?: string;

  // — Analysis inputs —
  compSearchRadiusMiles: number;
  compSoldWithinDays: number;     // e.g. 180

  // — Results —
  scenarios: AbsorptionScenario[];
  comparables: AbsorptionComparable[];

  // — Market context —
  submarketDescription?: string;
  supplyDemandSummary?: string;
  /** "thin but capable buyer pool" etc. */
  buyerPoolDescription?: string;
  competingSupplyNotes?: string;

  // — Report sections —
  projectOverviewText?: string;
  marketContextText?: string;
  appraisalSupportedOutlookText?: string;
  extraordinaryAssumptions?: string[];
  limitingConditions?: string[];
  intendedUseStatement?: string;
  uspapAlignmentStatement?: string;
  noGuaranteeStatement?: string;

  // — Report delivery —
  reportDocumentId?: string;
  reportTemplateKey?: string;
  completedByName?: string;
  completedByFirmName?: string;
  completedAt?: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// =============================================================================
// REQUEST / RESPONSE DTOs
// =============================================================================

export interface CreateAbsorptionStudyRequest {
  engagementId?: string;
  clientOrderId?: string;
  clientName?: string;
  developerName?: string;
  projectName?: string;
  subjectAddress: string;
  subjectCity: string;
  subjectState: string;
  subjectPostalCode: string;
  projectStage: ProjectStage;
  totalUnits: number;
  unitMix: UnitMixEntry[];
  indicativePricePerSqFt?: number;
  anticipatedCompletionDate?: string;
  linkedAppraisalOrderId?: string;
  compSearchRadiusMiles?: number;
  compSoldWithinDays?: number;
}

export interface UpdateAbsorptionStudyRequest {
  status?: AbsorptionStudyStatus;
  comparables?: AbsorptionComparable[];
  scenarios?: AbsorptionScenario[];
  submarketDescription?: string;
  supplyDemandSummary?: string;
  extraordinaryAssumptions?: string[];
  limitingConditions?: string[];
  completedByName?: string;
  completedByFirmName?: string;
}
