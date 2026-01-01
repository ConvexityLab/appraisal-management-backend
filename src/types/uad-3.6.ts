/**
 * UAD (Uniform Appraisal Dataset) 3.6 Type Definitions
 * 
 * Complete type system for Fannie Mae/Freddie Mac UAD 3.6 specification
 * Based on MISMO 3.4 standard
 * 
 * Reference: https://www.fanniemae.com/singlefamily/uniform-appraisal-dataset
 */

// ===========================
// UAD QUALITY AND CONDITION RATINGS
// ===========================

export enum UadQualityRating {
  Q1 = 'Q1', // Best quality - superior materials and workmanship
  Q2 = 'Q2', // Excellent - high quality materials and above average workmanship
  Q3 = 'Q3', // Good quality - good materials and average workmanship
  Q4 = 'Q4', // Average quality - adequate materials and workmanship
  Q5 = 'Q5', // Fair quality - low cost materials with average workmanship
  Q6 = 'Q6', // Poor quality - minimum standards, often distressed
}

export enum UadConditionRating {
  C1 = 'C1', // New/Never occupied - like new condition
  C2 = 'C2', // Like new - minimal wear and tear
  C3 = 'C3', // Well maintained - normal wear and tear
  C4 = 'C4', // Average - deferred maintenance apparent
  C5 = 'C5', // Fair - ongoing deferred maintenance
  C6 = 'C6', // Poor - substantial damage/deferred maintenance
}

// ===========================
// UAD PROPERTY TYPES
// ===========================

export enum UadPropertyType {
  DETACHED = 'Detached',
  SEMI_DETACHED = 'SemiDetached', 
  ROW_HOUSE = 'RowHouse',
  MANUFACTURED_HOME = 'ManufacturedHome',
  DETACHED_CONDO = 'DetachedCondo',
  ATTACHED_CONDO = 'AttachedCondo',
  MID_RISE_CONDO = 'MidRiseCondo',
  HIGH_RISE_CONDO = 'HighRiseCondo',
  COOPERATIVE = 'Cooperative',
  MODULAR = 'Modular',
  PUD = 'PUD', // Planned Unit Development
}

export enum UadOccupancyType {
  PRINCIPAL_RESIDENCE = 'PrincipalResidence',
  SECOND_HOME = 'SecondHome',
  INVESTMENT = 'Investment',
}

export enum UadAppraisalType {
  PURCHASE = 'Purchase',
  REFINANCE = 'Refinance',
  OTHER = 'Other',
}

export enum UadApproachToValue {
  SALES_COMPARISON = 'SalesComparison',
  COST = 'Cost',
  INCOME = 'Income',
}

// ===========================
// UAD VIEW TYPES
// ===========================

export enum UadViewType {
  TYPICAL = 'Typical',
  WATER_VIEW = 'WaterView',
  GOLF_COURSE = 'GolfCourse',
  MOUNTAIN = 'Mountain',
  PARK = 'Park',
  CITY_VIEW = 'CityView',
  WOODS_TREES = 'WoodsTrees',
  PASTORAL_AGRICULTURAL = 'PastoralAgricultural',
  RESIDENTIAL = 'Residential',
  POWER_LINES = 'PowerLines',
  LIMITED_SIGHT = 'LimitedSight',
  INDUSTRIAL_COMMERCIAL = 'IndustrialCommercial',
  BUSY_ROAD = 'BusyRoad',
}

export enum UadBuildingStatusType {
  EXISTING = 'Existing',
  PROPOSED = 'Proposed',
  UNDER_CONSTRUCTION = 'UnderConstruction',
}

// ===========================
// UAD COMPARABLE TYPES
// ===========================

export enum UadDataSourceType {
  MLS = 'MLS',
  PUBLIC_RECORDS = 'PublicRecords',
  APPRAISER = 'Appraiser',
  PRIOR_INSPECTION = 'PriorInspection',
  OTHER = 'Other',
}

export enum UadSaleType {
  ARM_LENGTH = 'ArmLength',
  NON_ARM_LENGTH = 'NonArmLength',
  REO = 'REO',
  SHORT_SALE = 'ShortSale',
  ESTATE_SALE = 'EstateSale',
  RELOCATION = 'Relocation',
  FORECLOSURE = 'Foreclosure',
  COURT_ORDERED = 'CourtOrdered',
}

export enum UadFinancingType {
  CONVENTIONAL = 'Conventional',
  FHA = 'FHA',
  VA = 'VA',
  USDA = 'USDA',
  CASH = 'Cash',
  SELLER_FINANCING = 'SellerFinancing',
  ASSUMED = 'Assumed',
  OTHER = 'Other',
}

// ===========================
// CORE UAD STRUCTURES
// ===========================

export interface UadAppraisalReport {
  // Report Identification
  appraisalReportIdentifier: string;
  appraisalFileNumber?: string;
  uadVersion: '3.6'; // Must be 3.6
  mismoVersion: '3.4'; // MISMO Standard version
  
  // Subject Property
  subjectProperty: UadSubjectProperty;
  
  // Appraisal Information
  appraisalInfo: UadAppraisalInfo;
  
  // Approaches to Value
  salesComparisonApproach?: UadSalesComparisonApproach;
  costApproach?: UadCostApproach;
  incomeApproach?: UadIncomeApproach;
  
  // Reconciliation
  reconciliation: UadReconciliation;
  
  // Appraiser Information
  appraiserInfo: UadAppraiserInfo;
  
  // Additional Data
  additionalFeatures?: UadAdditionalFeatures[];
  
  // Form Type
  formType: '1004' | '1073' | '1025' | '2055' | '1004C' | '216';
  
  // Certification & Statement
  certifications: UadCertification;
  
  // Attachments
  attachments?: UadAttachment[];
}

export interface UadSubjectProperty {
  // Property Address (UAD Required Fields)
  streetAddress: string;
  city: string;
  state: string; // Two-letter state code
  zipCode: string; // 5 or 9 digit format
  county: string;
  
  // Legal Description
  legalDescription?: string;
  assessorParcelNumber?: string;
  taxYear?: number;
  realEstateTaxes?: number;
  
  // Property Identification
  propertyType: UadPropertyType;
  occupancyType: UadOccupancyType;
  currentUse: string;
  
  // Site Information
  siteSizeSquareFeet?: number;
  siteSizeAcres?: number;
  siteShape: 'Rectangular' | 'Irregular' | 'Triangular' | 'Corner Lot';
  view: UadViewType[];
  
  // Improvements
  buildingStatus: UadBuildingStatusType;
  yearBuilt: number;
  effectiveAge?: number;
  
  // Size and Layout
  grossLivingArea: number; // Above grade in square feet
  totalRooms: number;
  totalBedrooms: number;
  totalBathrooms: number; // Full baths
  halfBathrooms?: number;
  
  // Construction Details
  foundationType: string;
  exteriorWalls: string;
  roofSurface: string;
  
  // Amenities
  heating: string;
  cooling: string;
  fireplaces?: number;
  garageType?: 'None' | 'Attached' | 'Detached' | 'Built-In' | 'Carport';
  garageCars?: number;
  
  // Basement
  basementArea?: number;
  basementFinishedArea?: number;
  
  // Pool
  pool?: 'None' | 'InGround' | 'AboveGround';
  
  // Quality and Condition (UAD Required)
  qualityRating: UadQualityRating;
  conditionRating: UadConditionRating;
  
  // Additional Rooms
  atticType?: 'None' | 'Scuttle' | 'Stairs' | 'Elevator' | 'Finished';
  amenities?: string[];
  
  // Location
  locationRating: 'Beneficial' | 'Neutral' | 'Adverse';
  
  // Zoning
  zoningClassification?: string;
  zoningCompliance: 'Legal' | 'LegalNonConforming' | 'Illegal';
  highestAndBestUse: 'Present' | 'Other';
  
  // Utilities
  publicUtilities: {
    electricity: 'Public' | 'Other';
    gas: 'Public' | 'Other';
    water: 'Public' | 'Other';
    sanitary: 'Public' | 'Septic' | 'Other';
  };
  
  // Off-site Improvements
  street: {
    paved: boolean;
    surfaceType?: string;
  };
  
  // Flood Zone
  femaFloodZone?: string;
  femaMapNumber?: string;
  femaMapDate?: Date;
}

export interface UadAppraisalInfo {
  // Assignment Information
  clientName: string;
  clientAddress: string;
  
  // Order Information  
  appraisalOrderDate: Date;
  inspectionDate: Date;
  reportDate: Date;
  
  // Intended Use and User
  intendedUse: string;
  intendedUser: string;
  
  // Property Rights Appraised
  propertyRightsAppraised: 'FeeSimple' | 'Leasehold' | 'Leased Fee' | 'Other';
  
  // Loan Information
  loanNumber?: string;
  fileNumber?: string;
  
  // Sale or Financing Details
  salePrice?: number;
  salePriceDate?: Date;
  loanTerms?: string;
  
  // Neighborhood
  neighborhood: UadNeighborhood;
  
  // Market Conditions
  marketConditions: UadMarketConditions;
  
  // Highest and Best Use
  highestAndBestUse: string;
}

export interface UadNeighborhood {
  // Location Characteristics
  location: 'Urban' | 'Suburban' | 'Rural';
  builtUp: 'Over 75%' | '25-75%' | 'Under 25%';
  
  // Growth Rate
  growth: 'Rapid' | 'Stable' | 'Slow';
  
  // Property Values
  propertyValues: 'Increasing' | 'Stable' | 'Declining';
  
  // Demand/Supply
  demandSupply: 'Shortage' | 'In Balance' | 'Over Supply';
  
  // Marketing Time
  marketingTime: 'Under 3 months' | '3-6 months' | 'Over 6 months';
  
  // Predominant Characteristics
  predominantOccupancy: 'Owner' | 'Tenant' | 'Vacant';
  singleFamilyPriceRange: {
    low: number;
    high: number;
  };
  predominantAge: string;
  
  // Present Land Use
  presentLandUse: {
    singleFamily: number; // percentage
    multifamily: number;
    commercial: number;
    other: number;
  };
  
  // Change
  landUseChange: 'Not Likely' | 'Likely' | 'In Process';
  
  // Boundaries and Description
  neighborhoodBoundaries?: string;
  neighborhoodDescription: string;
  
  // Market Conditions
  marketConditionsDescription: string;
}

export interface UadMarketConditions {
  competingPropertiesCurrentlyOnMarket: number;
  competingPropertiesInLast12Months: number;
  competingPropertiesAbsorptionRate: string;
  overallMarketTrend: 'Increasing' | 'Stable' | 'Declining';
  priceRangeLow: number;
  priceRangeHigh: number;
  averageDaysOnMarket: number;
  additionalComments?: string;
}

// ===========================
// SALES COMPARISON APPROACH
// ===========================

export interface UadSalesComparisonApproach {
  comparables: UadComparable[]; // Must have at least 3
  reconciliation: string;
  indicatedValueBySalesComparison: number;
}

export interface UadComparable {
  // Comparable Number (1-3 required, 4-6 optional)
  comparableNumber: number;
  
  // Address
  proximityToSubject: string; // e.g., "0.5 miles N"
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  
  // Sale Information
  salePrice: number;
  salePricePerGLA: number; // Price per gross living area
  saleDate: Date;
  dataSource: UadDataSourceType;
  verificationSource: string;
  
  // Sale Characteristics
  saleType: UadSaleType;
  financingType: UadFinancingType;
  concessionsAmount?: number;
  concessionsDescription?: string;
  
  // Property Characteristics
  propertyType: UadPropertyType;
  yearBuilt: number;
  effectiveAge?: number;
  grossLivingArea: number;
  siteSizeSquareFeet?: number;
  roomCount: number;
  bedroomCount: number;
  bathroomCount: number;
  
  // Construction
  basementArea?: number;
  basementFinishedArea?: number;
  functionalUtility: 'Good' | 'Average' | 'Fair' | 'Poor';
  
  // Garage
  garageType?: string;
  garageCars?: number;
  
  // Pool and Amenities
  pool?: string;
  porchPatioDecksqft?: number;
  otherAmenities?: string;
  
  // Quality and Condition
  qualityRating: UadQualityRating;
  conditionRating: UadConditionRating;
  
  // Location
  view: UadViewType[];
  locationRating: 'Beneficial' | 'Neutral' | 'Adverse';
  
  // Adjustments (Required for Sales Comparison)
  adjustments: UadAdjustments;
  
  // Adjusted Sale Price
  netAdjustment: number; // Sum of all adjustments
  grossAdjustment: number; // Absolute value sum
  adjustedSalePrice: number; // Sale price + net adjustment
}

export interface UadAdjustments {
  // Transactional Adjustments
  saleOrFinancingConcessions?: number;
  dateOfSale: number;
  locationAdjustment: number;
  
  // Physical Adjustments
  siteSize?: number;
  view?: number;
  design?: number;
  qualityOfConstruction?: number;
  actualAge?: number;
  condition?: number;
  aboveGradeRoomCount?: number;
  grossLivingArea: number;
  basementBelowGrade?: number;
  functionalUtility?: number;
  heatingCooling?: number;
  garageCarport?: number;
  porch?: number;
  pool?: number;
  otherAmenities?: number;
  
  // Additional Adjustments
  otherAdjustments?: {
    description: string;
    amount: number;
  }[];
}

// ===========================
// COST APPROACH
// ===========================

export interface UadCostApproach {
  // Land Value
  estimatedLandValue: number;
  landValueSource: string;
  
  // Improvements
  costNew: number;
  depreciationAmount: number;
  depreciationDescription: string;
  depreciatedCostOfImprovements: number;
  
  // As-Is Value
  asIsValue: number;
  
  // Additional Information
  supportedBy: string;
  comments?: string;
  
  // Indicated Value
  indicatedValueByCost: number;
}

// ===========================
// INCOME APPROACH
// ===========================

export interface UadIncomeApproach {
  // Rent Information
  estimatedMonthlyMarketRent: number;
  grossRentMultiplier: number;
  
  // Analysis
  rentComparables?: UadRentComparable[];
  
  // Indicated Value
  indicatedValueByIncome: number;
  
  // Comments
  comments?: string;
}

export interface UadRentComparable {
  address: string;
  proximityToSubject: string;
  monthlyRent: number;
  dataSource: string;
  propertyDescription: string;
}

// ===========================
// RECONCILIATION
// ===========================

export interface UadReconciliation {
  // Approaches Used
  salesComparisonApproachUsed: boolean;
  salesComparisonValue?: number;
  salesComparisonWeight?: number;
  
  costApproachUsed: boolean;
  costApproachValue?: number;
  costApproachWeight?: number;
  
  incomeApproachUsed: boolean;
  incomeApproachValue?: number;
  incomeApproachWeight?: number;
  
  // Final Value Opinion
  finalOpinionOfValue: number;
  effectiveDate: Date;
  
  // Reconciliation Comments
  reconciliationComments: string;
  
  // Subject Property Status
  subjectPropertyInspected: boolean;
  interiorInspected: boolean;
  
  // Extraordinary Assumptions
  extraordinaryAssumptions?: string[];
  hypotheticalConditions?: string[];
}

// ===========================
// APPRAISER INFORMATION
// ===========================

export interface UadAppraiserInfo {
  // Primary Appraiser
  name: string;
  companyName: string;
  companyAddress: string;
  telephoneNumber: string;
  emailAddress: string;
  
  // License Information
  stateCertificationNumber: string;
  stateOfCertification: string;
  certificationType: 'Certified General' | 'Certified Residential' | 'Licensed';
  expirationDate: Date;
  
  // Supervisory Appraiser (if applicable)
  supervisoryAppraiser?: {
    name: string;
    stateCertificationNumber: string;
    stateOfCertification: string;
    certificationType: string;
    expirationDate: Date;
    inspectedProperty: boolean;
  };
  
  // Signature
  signatureDate: Date;
  digitalSignature?: string;
}

// ===========================
// ADDITIONAL FEATURES
// ===========================

export interface UadAdditionalFeatures {
  featureType: string;
  featureDescription: string;
  estimatedValue?: number;
}

// ===========================
// CERTIFICATION
// ===========================

export interface UadCertification {
  // Required Certifications (per UAD/USPAP)
  personalInspectionOfSubjectProperty: boolean;
  personalInspectionOfExteriorOfComparables: boolean;
  
  // Bias and Conflict of Interest
  noCurrentOrProspectiveInterestInProperty: boolean;
  noPersonalInterestOrBias: boolean;
  feeNotContingentOnValueReported: boolean;
  
  // USPAP Compliance
  complianceWithUSPAP: boolean;
  developedInAccordanceWithUSPAP: boolean;
  
  // Analysis and Reporting
  reportedAllKnownAdverseFactors: boolean;
  propertyInspectionDate: Date;
  
  // Additional Statements
  additionalCertifications?: string[];
  limitingConditions?: string[];
  
  // Appraiser Statements
  appraiserStatement: string;
  certificationDate: Date;
}

// ===========================
// ATTACHMENTS
// ===========================

export interface UadAttachment {
  attachmentType: 'Photo' | 'Map' | 'FloorPlan' | 'BuildingSketch' | 'AddendumOther';
  fileName: string;
  fileType: string; // MIME type
  fileContent?: string; // Base64 encoded
  description: string;
  required: boolean;
}

// ===========================
// UAD VALIDATION ERRORS
// ===========================

export interface UadValidationError {
  fieldPath: string; // e.g., 'subjectProperty.qualityRating'
  errorCode: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  uadRule?: string; // Reference to UAD rule violated
}

export interface UadValidationResult {
  isValid: boolean;
  errors: UadValidationError[];
  warnings: UadValidationError[];
  validatedAt: Date;
  uadVersion: '3.6';
}

// ===========================
// SUBMISSION DATA
// ===========================

export interface UadSubmissionRequest {
  appraisalReport: UadAppraisalReport;
  loanIdentifier: string;
  submitterInfo: {
    lenderName: string;
    lenderIdentifier: string;
    submittingUserName: string;
    submittingUserId: string;
  };
  submissionType: 'Original' | 'Revision' | 'Recertification';
  revisionNumber?: number;
}

export interface UadSubmissionResponse {
  submissionId: string;
  ucdpDocumentId?: string; // Fannie Mae UCDP ID
  eadDocumentId?: string; // Freddie Mac EAD ID
  status: 'Accepted' | 'Rejected' | 'Pending';
  submittedAt: Date;
  gseMessages?: UadGseMessage[];
}

export interface UadGseMessage {
  messageType: 'Error' | 'Warning' | 'Information';
  messageCode: string;
  messageText: string;
  fieldName?: string;
}
