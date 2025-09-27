/**
 * Enhanced Property Types - Two-Level Architecture
 * 
 * This module provides both lightweight PropertySummary for common operations
 * and comprehensive PropertyDetails for full data access, optimizing performance
 * by preventing unnecessary data transfer.
 */

// ===========================
// Core Property Enums
// ===========================

export enum PropertyType {
  SFR = 'single_family_residential',
  CONDO = 'condominium',
  TOWNHOME = 'townhome',
  MULTI_FAMILY = 'multi_family',
  COMMERCIAL = 'commercial',
  LAND = 'land',
  MANUFACTURED = 'manufactured_home'
}

export enum PropertyCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  FAIR = 'fair',
  POOR = 'poor'
}

export enum BuildingCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good', 
  AVERAGE = 'average',
  FAIR = 'fair',
  POOR = 'poor'
}

export enum BuildingQuality {
  A_PLUS = 'A+',
  A = 'A',
  B_PLUS = 'B+',
  B = 'B',
  C_PLUS = 'C+',
  C = 'C',
  D = 'D'
}

// ===========================
// Lightweight Property Summary
// ===========================

/**
 * PropertySummary - Lightweight property data for listings, searches, and common operations
 * Contains only the most frequently accessed fields to optimize performance
 */
export interface PropertySummary {
  // Core identification
  id: string;
  _id?: string; // External API ID
  
  // Essential address information
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
    latitude?: number;
    longitude?: number;
  };
  
  // Basic property characteristics
  propertyType: PropertyType;
  condition?: PropertyCondition;
  
  // Key building details
  building: {
    yearBuilt?: number;
    livingAreaSquareFeet?: number;
    bedroomCount?: number;
    bathroomCount?: number;
    storyCount?: number;
    garageParkingSpaceCount?: number;
  };
  
  // Essential valuation
  valuation: {
    estimatedValue?: number;
    priceRangeMin?: number;
    priceRangeMax?: number;
    confidenceScore?: number;
    asOfDate?: Date;
  };
  
  // Owner information (summary)
  owner: {
    fullName?: string;
    ownerOccupied?: boolean;
  };
  
  // Quick indicators
  quickLists: {
    vacant?: boolean;
    ownerOccupied?: boolean;
    freeAndClear?: boolean;
    highEquity?: boolean;
    activeForSale?: boolean;
    recentlySold?: boolean;
  };
  
  // Metadata
  lastUpdated: Date;
  dataSource?: string;
}

// ===========================
// Comprehensive Property Details
// ===========================

/**
 * PropertyDetails - Complete property data structure matching external API schema
 * Used for detailed analysis, appraisals, and comprehensive reporting
 */
export interface PropertyDetails extends PropertySummary {
  // Extended address information
  address: PropertySummary['address'] & {
    houseNumber?: string;
    cityAliases?: string[];
    zipPlus4?: string;
    formattedStreet?: string;
    streetNoUnit?: string;
    localities?: string[];
    countyFipsCode?: string;
    hash?: string;
    normalized?: boolean;
    geoStatus?: string;
    geoStatusCode?: string;
    oldHashes?: string[];
  };
  
  // Comprehensive assessment data
  assessment: {
    assessedImprovementValue?: number;
    assessedLandValue?: number;
    totalAssessedValue?: number;
    assessmentYear?: number;
    improvementMarketValue?: number;
    landMarketValue?: number;
    totalMarketValue?: number;
    marketValueYear?: number;
  };
  
  // Detailed building information
  building: PropertySummary['building'] & {
    totalBuildingAreaSquareFeet?: number;
    totalBuildingAreaCode?: string;
    totalBuildingAreaCodeDescription?: string;
    effectiveYearBuilt?: number;
    buildingCount?: number;
    roomCount?: number;
    unitCount?: number;
    calculatedBathroomCount?: number;
    fullBathroomCount?: number;
    bathFixtureCount?: number;
    residentialUnitCount?: number;
    features?: string[];
    airConditioningSourceCode?: string;
    airConditioningSource?: string;
    buildingConditionCode?: string;
    buildingCondition?: BuildingCondition;
    buildingQualityCode?: string;
    buildingQuality?: BuildingQuality;
    constructionTypeCode?: string;
    constructionType?: string;
    exteriorWallsCode?: string;
    exteriorWalls?: string;
    garageCode?: string;
    garage?: string;
    heatSourceCode?: string;
    heatSource?: string;
    patioCode?: string;
    patio?: string;
    poolCode?: string;
    pool?: string;
    roofCoverCode?: string;
    roofCover?: string;
    fireplaceCount?: number;
  };
  
  // Deed and ownership history
  deedHistory: Array<{
    buyers?: string[];
    sellers?: string[];
    recordingDate?: Date;
    saleDate?: Date;
    documentNumber?: string;
    documentTypeCode?: string;
    documentType?: string;
    salePrice?: number;
    interFamily?: boolean;
  }>;
  
  // Demographics data
  demographics: Record<string, any>;
  
  // Foreclosure information
  foreclosure: {
    preforeclosure?: boolean;
    noticeOfDefault?: boolean;
    noticeOfSale?: boolean;
    auctionDate?: Date;
    trusteeInfo?: any;
  };
  
  // General property information
  general: {
    carrierRoute?: string;
    vacant?: boolean;
    mailingAddressVacant?: boolean;
    standardizedLandUseCode?: string;
    propertyTypeCategory?: string;
    propertyTypeDetail?: string;
    congressionalDistrict?: string;
    timeZone?: string;
    utcOffset?: number;
    daylightSavingsTime?: boolean;
    censusTract?: string;
    primaryParcel?: boolean;
    parcelCount?: number;
  };
  
  // Property IDs and references
  ids: {
    addressHash?: string;
    apn?: string;
    oldApn?: string;
    fipsCode?: string;
  };
  
  // Legal description and zoning
  legal: {
    assessorsMapReference?: string;
    cityTownshipMunicipality?: string;
    legalDescription?: string;
    lotCode?: string;
    lotNumber?: string;
    sectionTownshipRangeMeridian?: string;
    subdivisionName?: string;
    tractNumber?: string;
  };
  
  // Lot and zoning information
  lot: {
    lotSizeAcres?: number;
    lotSizeSquareFeet?: number;
    zoningCode?: string;
  };
  
  // Listing information
  listing: {
    brokerage?: Record<string, any>;
    agents?: Record<string, any>;
    listPrice?: number;
    listDate?: Date;
    daysOnMarket?: number;
    status?: string;
  };
  
  // Mortgage history
  mortgageHistory: Array<{
    borrowers?: string[];
    saleDate?: Date;
    recordingDate?: Date;
    dueDate?: Date;
    lenderName?: string;
    loanAmount?: number;
    loanTermMonths?: number;
    interestRate?: number;
    loanTypeCode?: string;
    loanType?: string;
  }>;
  
  // Open liens
  openLien: {
    allLoanTypes?: string[];
    juniorLoanTypes?: string[];
    totalOpenLienCount?: number;
    mortgages?: Record<string, any>;
  };
  
  // Detailed owner information
  owner: PropertySummary['owner'] & {
    mailingAddress?: {
      houseNumber?: string;
      street?: string;
      city?: string;
      county?: string;
      state?: string;
      zip?: string;
      zipPlus4?: string;
      formattedStreet?: string;
      streetNoUnit?: string;
      hash?: string;
      oldHashes?: string[];
    };
    names?: Array<{
      first?: string;
      middle?: string;
      last?: string;
      full?: string;
    }>;
    ownerStatusTypeCode?: string;
    ownerStatusType?: string;
    ownershipRightsCode?: string;
    ownershipRights?: string;
  };
  
  // Permit information
  permit: {
    allTags?: string[];
    permitCount?: number;
    earliestDate?: Date;
    latestDate?: Date;
    totalJobValue?: number;
    tags?: {
      addition?: boolean;
      adu?: boolean;
      bathroom?: boolean;
      battery?: boolean;
      demolition?: boolean;
      electricMeter?: boolean;
      electrical?: boolean;
      evCharger?: boolean;
      fireSprinkler?: boolean;
      gas?: boolean;
      generator?: boolean;
      grading?: boolean;
      heatPump?: boolean;
      hvac?: boolean;
      inspectionPassed?: boolean;
      kitchen?: boolean;
      newConstruction?: boolean;
      plumbing?: boolean;
      poolAndHotTub?: boolean;
      remodel?: boolean;
      roofing?: boolean;
      solar?: boolean;
      waterHeater?: boolean;
      windowDoor?: boolean;
    };
  };
  
  // Property owner profile
  propertyOwnerProfile: {
    averageYearBuilt?: number;
    propertiesCount?: number;
    propertiesTotalEquity?: number;
    propertiesTotalEstimatedValue?: number;
  };
  
  // Extended quick lists
  quickLists: PropertySummary['quickLists'] & {
    absenteeOwner?: boolean;
    absenteeOwnerInState?: boolean;
    absenteeOwnerOutOfState?: boolean;
    activeListing?: boolean;
    activeAuction?: boolean;
    cashBuyer?: boolean;
    corporateOwned?: boolean;
    expiredListing?: boolean;
    lowEquity?: boolean;
    mailingAddressVacant?: boolean;
    onMarket?: boolean;
    outOfStateOwner?: boolean;
    pendingListing?: boolean;
    preforeclosure?: boolean;
    samePropertyAndMailingAddress?: boolean;
    taxDefault?: boolean;
    tiredLandlord?: boolean;
    unknownEquity?: boolean;
    hasHoa?: boolean;
    hasHoaFees?: boolean;
    canceledListing?: boolean;
    noticeOfSale?: boolean;
    noticeOfDefault?: boolean;
    noticeOfLisPendens?: boolean;
    inherited?: boolean;
    listedBelowMarketPrice?: boolean;
  };
  
  // Sale information
  sale: {
    lastTransfer?: {
      documentNumber?: string;
      documentType?: string;
      priceCodeDescription?: string;
      priceCode?: string;
      recordingDate?: Date;
      saleDate?: Date;
    };
    lastSale?: {
      saleBuyers?: string[];
      saleSellers?: string[];
      salePriceIsEstimated?: boolean;
      salePrice?: number;
    };
    flipLength?: number;
    flipLengthCategory?: number;
    flipProfit?: number;
    priorTransfer?: {
      documentNumber?: string;
      documentType?: string;
      priceCodeDescription?: string;
      priceCode?: string;
      salePriceIsEstimated?: boolean;
    };
    priorSale?: {
      recordingDate?: Date;
      saleBuyers?: string[];
      saleSellers?: string[];
      salePriceIsEstimated?: boolean;
      salePrice?: number;
    };
  };
  
  // Tax information
  tax: {
    taxAmount?: number;
    taxYear?: number;
    taxDelinquentYear?: number;
    taxRateCodeArea?: string;
  };
  
  // Extended valuation information
  valuation: PropertySummary['valuation'] & {
    standardDeviation?: number;
    equityCurrentEstimatedBalance?: number;
    ltv?: number;
    equityPercent?: number;
  };
  
  // Metadata
  meta: {
    propertyDateModified?: Date;
    apiVersion?: string;
    dataProvider?: string;
    requestId?: string;
  };
}

// ===========================
// Property Search Interfaces
// ===========================

/**
 * Property search criteria for lightweight searches
 */
export interface PropertySearchCriteria {
  // Text search
  textQuery?: string;
  
  // Location filters
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
  };
  
  // Geographic filters
  geographic?: {
    bounds?: { north: number; south: number; east: number; west: number };
    radius?: { lat: number; lng: number; miles: number };
    polygon?: { lat: number; lng: number }[];
  };
  
  // Property characteristics
  propertyType?: PropertyType[];
  condition?: PropertyCondition[];
  
  // Numeric ranges
  yearBuiltRange?: { min?: number; max?: number };
  squareFootageRange?: { min?: number; max?: number };
  bedroomRange?: { min?: number; max?: number };
  bathroomRange?: { min?: number; max?: number };
  
  // Valuation filters
  priceRange?: { min?: number; max?: number };
  
  // Quick filters
  vacant?: boolean;
  ownerOccupied?: boolean;
  freeAndClear?: boolean;
  highEquity?: boolean;
  
  // Pagination and sorting
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Property search results for lightweight operations
 */
export interface PropertySearchResults {
  properties: PropertySummary[];
  total: number;
  aggregations?: {
    byPropertyType: Record<string, number>;
    byCondition: Record<string, number>;
    byPriceRange: Record<string, number>;
    averageSquareFootage: number;
    averagePrice: number;
  };
  searchCriteria: PropertySearchCriteria;
}

/**
 * Detailed property search results
 */
export interface DetailedPropertySearchResults {
  properties: PropertyDetails[];
  total: number;
  aggregations?: {
    byPropertyType: Record<string, number>;
    byCondition: Record<string, number>;
    byPriceRange: Record<string, number>;
    byOwnerType: Record<string, number>;
    averageSquareFootage: number;
    averagePrice: number;
    averageLotSize: number;
    averageYearBuilt: number;
  };
  searchCriteria: PropertySearchCriteria;
}

// ===========================
// Property Creation/Update
// ===========================

/**
 * Data for creating a new property summary
 */
export interface CreatePropertySummaryRequest {
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  };
  propertyType: PropertyType;
  condition?: PropertyCondition;
  building?: {
    yearBuilt?: number;
    livingAreaSquareFeet?: number;
    bedroomCount?: number;
    bathroomCount?: number;
  };
  valuation?: {
    estimatedValue?: number;
  };
}

/**
 * Data for updating property summary
 */
export interface UpdatePropertySummaryRequest extends Partial<CreatePropertySummaryRequest> {
  id: string;
}

// ===========================
// Property Data Transformation
// ===========================

/**
 * Utility type for converting comprehensive property data to summary
 */
export type PropertyDetailsToSummary = (details: PropertyDetails) => PropertySummary;

/**
 * Utility type for enriching summary with detailed data
 */
export type PropertySummaryToDetails = (summary: PropertySummary, additionalData?: Partial<PropertyDetails>) => PropertyDetails;