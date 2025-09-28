/**
 * Enhanced Property Intelligence Types
 * Comprehensive property characteristics and location-based features
 */

import { Coordinates } from './geospatial';

// ===========================
// ADDRESS SERVICES
// ===========================

export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city: string;
  state: string;
  postalCode: string;
  county?: string;
  country: string;
  formattedAddress: string;
}

export interface GeocodingResult {
  address: AddressComponents;
  coordinates: Coordinates;
  precision: 'exact' | 'interpolated' | 'geometric_center' | 'approximate';
  confidence: number; // 0-1
  provider: string;
  placeId?: string;
  boundingBox?: {
    northeast: Coordinates;
    southwest: Coordinates;
  };
}

export interface AddressValidationResult {
  isValid: boolean;
  originalAddress: string;
  standardizedAddress?: AddressComponents;
  validationIssues: string[];
  deliverabilityScore: number; // 0-1
  uspsData?: {
    dpvConfirmed: boolean;
    vacant: boolean;
    businessAddress: boolean;
  };
}

// ===========================
// CREATIVE PROPERTY CHARACTERISTICS
// ===========================

// View Analysis
export interface ViewAnalysis {
  waterView: {
    hasView: boolean;
    viewType: 'ocean' | 'lake' | 'river' | 'bay' | 'pond' | 'none';
    viewQuality: 'panoramic' | 'partial' | 'glimpse' | 'obstructed' | 'none';
    distanceToWater: number; // meters
    elevationAdvantage: number; // meters above surrounding area
    lineOfSightClear: boolean;
    viewScore: number; // 0-100
  };
  cityView: {
    hasCityView: boolean;
    skylineView: boolean;
    cityLightView: boolean;
    viewDirection: string[];
    distanceToCity: number;
    elevationAdvantage: number;
    viewScore: number;
  };
  mountainView: {
    hasMountainView: boolean;
    peakNames: string[];
    viewDirection: string[];
    distanceToNearest: number;
    elevationDifference: number;
    viewScore: number;
  };
  natureView: {
    hasNatureView: boolean;
    viewTypes: ('forest' | 'park' | 'preserve' | 'golf_course' | 'farmland')[];
    protectedLand: boolean; // permanent view protection
    viewScore: number;
  };
  undesirableViews: {
    industrialView: boolean;
    highwayView: boolean;
    powerLinesView: boolean;
    landfillView: boolean;
    cemeteryView: boolean;
    negativeViewScore: number;
  };
}

// Transportation & Accessibility
export interface TransportationAnalysis {
  airports: {
    majorAirport: {
      name: string;
      distance: number;
      driveTime: number;
      inFlightPath: boolean;
      noiseLevel: 'low' | 'moderate' | 'high' | 'severe';
    };
    privateAirports: Array<{
      name: string;
      distance: number;
      type: 'private' | 'corporate' | 'general_aviation';
    }>;
  };
  railroads: {
    nearRailroad: boolean;
    railroadTypes: ('freight' | 'passenger' | 'light_rail' | 'subway')[];
    distanceToNearest: number;
    noiseImpact: 'none' | 'minimal' | 'moderate' | 'significant';
    trainFrequency: number; // trains per day
  };
  highways: {
    nearMajorHighway: boolean;
    highwayNames: string[];
    distanceToNearest: number;
    trafficVolume: number; // vehicles per day
    noiseLevel: 'low' | 'moderate' | 'high';
  };
  publicTransport: {
    walkabilityScore: number; // 0-100
    transitScore: number; // 0-100
    bikeScore: number; // 0-100
    nearestSubway: {
      distance: number;
      walkTime: number;
      stationName: string;
      lines: string[];
    };
    nearestBusStop: {
      distance: number;
      walkTime: number;
      routes: string[];
    };
  };
}

// Location Characteristics
export interface LocationCharacteristics {
  ruralityIndex: {
    score: number; // 0-100 (0 = urban core, 100 = remote rural)
    classification: 'urban_core' | 'urban' | 'suburban' | 'exurban' | 'rural' | 'remote_rural';
    populationDensity: number; // people per sq km
    distanceToUrbanCenter: number;
    developmentDensity: 'high' | 'medium' | 'low' | 'sparse';
  };
  beachProximity: {
    nearBeach: boolean;
    beachType: 'ocean' | 'lake' | 'river' | 'none';
    distance: number;
    walkTime: number;
    driveTime: number;
    beachQuality: 'pristine' | 'good' | 'average' | 'poor';
    publicAccess: boolean;
    beachAmenities: string[];
  };
  waterAccess: {
    nearWater: boolean;
    waterBodies: Array<{
      type: 'ocean' | 'lake' | 'river' | 'bay' | 'pond' | 'reservoir';
      name: string;
      distance: number;
      navigable: boolean;
      publicAccess: boolean;
      recreation: string[];
    }>;
  };
  topography: {
    elevation: number;
    slope: number; // degrees
    aspect: string; // N, NE, E, SE, S, SW, W, NW
    floodplain: boolean;
    hillside: boolean;
    ridgeline: boolean;
    valley: boolean;
  };
}

// Proximity to Services & Amenities
export interface ProximityAnalysis {
  essentialServices: {
    grocery: {
      nearest: {
        name: string;
        chain: string;
        distance: number;
        walkTime: number;
        driveTime: number;
        quality: 'premium' | 'standard' | 'discount';
      };
      count_1mile: number;
      count_3miles: number;
    };
    pharmacy: {
      nearest: {
        name: string;
        distance: number;
        walkTime: number;
        driveTime: number;
        is24Hour: boolean;
      };
      count_1mile: number;
    };
    gasStation: {
      nearest: {
        name: string;
        brand: string;
        distance: number;
        driveTime: number;
      };
      count_2miles: number;
    };
    postOffice: {
      nearest: {
        distance: number;
        driveTime: number;
        serviceType: 'full_service' | 'retail' | 'contract';
      };
    };
  };
  dining: {
    restaurants: {
      count_1mile: number;
      count_3miles: number;
      averageRating: number;
      priceRange: {
        budget: number;
        mid_range: number;
        upscale: number;
        fine_dining: number;
      };
      cuisineVariety: string[];
    };
    coffee: {
      starbucks: {
        nearest: {
          distance: number;
          walkTime: number;
          driveTime: number;
        };
        count_3miles: number;
      };
      independentCoffee: {
        count_1mile: number;
        averageRating: number;
      };
    };
  };
  healthcare: {
    hospitals: {
      nearest: {
        name: string;
        distance: number;
        driveTime: number;
        level: 'level_1_trauma' | 'level_2_trauma' | 'general' | 'specialty';
        rating: number;
      };
      count_10miles: number;
    };
    urgentCare: {
      nearest: {
        name: string;
        distance: number;
        driveTime: number;
      };
      count_5miles: number;
    };
    specialtyCare: {
      count_10miles: number;
      specialties: string[];
    };
  };
  education: {
    elementarySchools: {
      nearest: {
        name: string;
        distance: number;
        walkTime: number;
        rating: number; // 1-10
        testScores: number;
        studentTeacherRatio: number;
      };
      count_2miles: number;
      averageRating: number;
    };
    middleSchools: {
      nearest: {
        name: string;
        distance: number;
        rating: number;
      };
      count_3miles: number;
    };
    highSchools: {
      nearest: {
        name: string;
        distance: number;
        rating: number;
        graduationRate: number;
        collegeReadiness: number;
      };
      count_5miles: number;
    };
    colleges: {
      nearest: {
        name: string;
        distance: number;
        type: 'community_college' | 'public_university' | 'private_university' | 'trade_school';
        ranking: number;
      };
      count_25miles: number;
    };
  };
  recreation: {
    parks: {
      nearest: {
        name: string;
        distance: number;
        walkTime: number;
        size: number; // acres
        amenities: string[];
        type: 'neighborhood' | 'community' | 'regional' | 'state' | 'national';
      };
      count_2miles: number;
      totalAcres_2miles: number;
    };
    gyms: {
      count_3miles: number;
      chains: string[];
      averageMonthlyFee: number;
    };
    golfCourses: {
      nearest: {
        name: string;
        distance: number;
        driveTime: number;
        type: 'public' | 'private' | 'semi_private';
        rating: number;
        holes: number;
      };
      count_10miles: number;
    };
    waterRecreation: {
      marinas: {
        count_10miles: number;
        nearest?: {
          name: string;
          distance: number;
          services: string[];
        };
      };
      beaches: {
        count_25miles: number;
        nearest?: {
          name: string;
          distance: number;
          type: 'ocean' | 'lake' | 'river';
          amenities: string[];
        };
      };
    };
  };
}

// Crime & Safety Analysis
export interface CrimeAnalysis {
  crimeIndex: {
    overall: number; // 0-100 (0 = safest, 100 = most dangerous)
    violent: number;
    property: number;
    trend: 'improving' | 'stable' | 'worsening';
    comparedToCity: 'much_lower' | 'lower' | 'average' | 'higher' | 'much_higher';
    comparedToNational: 'much_lower' | 'lower' | 'average' | 'higher' | 'much_higher';
  };
  crimeTypes: {
    homicide: { rate: number; incidents_12months: number };
    assault: { rate: number; incidents_12months: number };
    robbery: { rate: number; incidents_12months: number };
    burglary: { rate: number; incidents_12months: number };
    theft: { rate: number; incidents_12months: number };
    vehicleTheft: { rate: number; incidents_12months: number };
  };
  safetyFeatures: {
    streetLighting: 'excellent' | 'good' | 'adequate' | 'poor';
    policeResponse: {
      averageTime: number; // minutes
      nearestStation: {
        distance: number;
        driveTime: number;
      };
    };
    emergencyServices: {
      fireStation: {
        distance: number;
        responseTime: number;
      };
      hospital: {
        distance: number;
        responseTime: number;
      };
    };
  };
}

// Demographics & Socioeconomics
export interface DemographicAnalysis {
  population: {
    total: number;
    density: number; // per sq mile
    growthRate: number; // annual %
    ageDistribution: {
      under18: number;
      age18to34: number;
      age35to54: number;
      age55to74: number;
      over75: number;
    };
  };
  income: {
    medianHouseholdIncome: number;
    perCapitaIncome: number;
    povertyRate: number;
    incomeDistribution: {
      under25k: number;
      from25to50k: number;
      from50to75k: number;
      from75to100k: number;
      from100to150k: number;
      over150k: number;
    };
  };
  housing: {
    medianHomeValue: number;
    homeValueAppreciation: number; // annual %
    homeownershipRate: number;
    rentVsOwn: {
      ownerOccupied: number;
      renterOccupied: number;
    };
    housingTypes: {
      singleFamily: number;
      townhouse: number;
      condo: number;
      apartment: number;
    };
  };
  education: {
    highSchoolGraduation: number;
    bachelorsOrHigher: number;
    graduateDegree: number;
  };
  employment: {
    unemploymentRate: number;
    majorIndustries: string[];
    averageCommute: number; // minutes
    workFromHome: number; // percentage
  };
}

// Environmental & Quality of Life
export interface QualityOfLifeAnalysis {
  airQuality: {
    aqi: number; // Air Quality Index
    pm25: number;
    ozone: number;
    rating: 'excellent' | 'good' | 'moderate' | 'unhealthy' | 'hazardous';
    healthRisk: 'low' | 'moderate' | 'high';
  };
  noiseLevel: {
    averageDecibels: number;
    sources: string[];
    rating: 'very_quiet' | 'quiet' | 'moderate' | 'noisy' | 'very_noisy';
    peakHours: string[];
  };
  lightPollution: {
    bortle: number; // 1-9 scale
    rating: 'excellent' | 'good' | 'moderate' | 'poor' | 'terrible';
    starVisibility: boolean;
  };
  climate: {
    averageTemp: {
      summer: number;
      winter: number;
      annual: number;
    };
    precipitation: {
      annual: number; // inches
      snowfall: number; // inches
    };
    sunnyDays: number;
    humidityLevel: 'low' | 'moderate' | 'high';
    extremeWeatherRisk: string[];
  };
}

// ===========================
// COMPREHENSIVE PROPERTY INTELLIGENCE
// ===========================

export interface PropertyIntelligence {
  propertyId: string;
  address: AddressComponents;
  coordinates: Coordinates;
  assessmentDate: Date;
  
  // Core analyses
  viewAnalysis: ViewAnalysis;
  locationCharacteristics: LocationCharacteristics;
  transportationAnalysis: TransportationAnalysis;
  proximityAnalysis: ProximityAnalysis;
  crimeAnalysis: CrimeAnalysis;
  demographicAnalysis: DemographicAnalysis;
  qualityOfLifeAnalysis: QualityOfLifeAnalysis;
  
  // Scoring
  overallDesirabilityScore: number; // 0-100
  investmentPotentialScore: number; // 0-100
  livabilityScore: number; // 0-100
  
  // Key highlights
  positiveFeatures: string[];
  negativeFeatures: string[];
  uniqueCharacteristics: string[];
  investmentRecommendations: string[];
}

// ===========================
// API RESPONSE TYPES
// ===========================

export interface PropertyIntelligenceResponse {
  success: boolean;
  data?: PropertyIntelligence;
  error?: string;
  metadata: {
    processingTime: number;
    dataSourcesUsed: string[];
    lastUpdated: Date;
    cacheHit: boolean;
  };
}

export interface BatchPropertyIntelligenceResponse {
  success: boolean;
  results: Array<{
    propertyId: string;
    success: boolean;
    data?: PropertyIntelligence;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}

// ===========================
// DATA SOURCE PROVIDER TYPES
// ===========================

export interface DataSourceProvider {
  name: string;
  type: 'api' | 'database' | 'service';
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerDay: number;
  };
  cost?: {
    freeRequests: number;
    costPerRequest: number;
  };
  reliability: number; // 0-1
  dataQuality: number; // 0-1
}

export interface POISearchResult {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  coordinates: Coordinates;
  distance: number;
  address: string;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  hours?: string;
  phone?: string;
  website?: string;
  attributes: Record<string, any>;
}

// ===========================
// U.S. CENSUS DATA INTELLIGENCE TYPES
// ===========================

export interface DemographicIntelligence {
  demographicCompatibilityScore: number; // 0-100
  
  populationCharacteristics: {
    totalPopulation: number;
    populationDensity: number; // per sq mile
    populationGrowthRate: number; // 5-year trend
    ageDistribution: {
      under18: number;
      age18to34: number;
      age35to54: number;
      age55to74: number;
      over75: number;
      medianAge: number;
    };
    generationalMix: {
      genZ: number; // % under 25
      millennials: number; // % 25-40
      genX: number; // % 41-56
      boomers: number; // % 57-75
      silent: number; // % over 75
    };
  };

  householdComposition: {
    averageHouseholdSize: number;
    familyHouseholds: number; // percentage
    singlePersonHouseholds: number;
    householdsWithChildren: number;
    marriedCoupleHouseholds: number;
    singleParentHouseholds: number;
  };

  diversityMetrics: {
    racialDiversityIndex: number; // 0-100 (Simpson's Diversity Index)
    ethnicComposition: {
      white: number;
      black: number;
      hispanic: number;
      asian: number;
      nativeAmerican: number;
      pacificIslander: number;
      multiracial: number;
    };
    languageDiversity: {
      englishOnly: number;
      spanish: number;
      otherLanguages: number;
      linguisticIsolation: number; // households with limited English
    };
  };
}

export interface EconomicIntelligence {
  economicVitalityScore: number; // 0-100
  
  incomeMetrics: {
    medianHouseholdIncome: number;
    perCapitaIncome: number;
    incomeDistribution: {
      under25k: number;
      income25to50k: number;
      income50to75k: number;
      income75to100k: number;
      income100to150k: number;
      over150k: number;
    };
    incomeGrowthRate: number; // 5-year trend
    giniCoefficient: number; // income inequality measure
  };

  employmentCharacteristics: {
    unemploymentRate: number;
    laborForceParticipation: number;
    employmentByIndustry: {
      professional: number;
      healthcare: number;
      retail: number;
      manufacturing: number;
      education: number;
      government: number;
      technology: number;
      finance: number;
    };
    workFromHomeRate: number; // % working from home
    commuteTimes: {
      averageCommuteMinutes: number;
      under15min: number;
      over60min: number;
    };
  };

  economicStability: {
    povertyRate: number;
    publicAssistanceRate: number;
    snapBenefitsRate: number; // food assistance
    medicaidCoverage: number;
    economicMobilityIndex: number; // opportunity for advancement
  };
}

export interface HousingIntelligence {
  housingMarketScore: number; // 0-100
  
  housingStock: {
    totalHousingUnits: number;
    occupancyRate: number;
    vacancyRate: number;
    ownerOccupiedRate: number;
    renterOccupiedRate: number;
    
    housingTypes: {
      singleFamily: number; // percentage
      townhouse: number;
      smallApartment: number; // 2-4 units
      largeApartment: number; // 5+ units
      mobileHome: number;
      other: number;
    };
    
    housingAge: {
      built2020orLater: number;
      built2010to2019: number;
      built2000to2009: number;
      built1990to1999: number;
      built1980to1989: number;
      built1970to1979: number;
      builtBefore1970: number;
    };
  };

  housingAffordability: {
    medianHomeValue: number;
    medianGrossRent: number;
    housingCostBurden: {
      under30percent: number; // paying <30% income on housing
      percent30to50: number;  // paying 30-50% income on housing
      over50percent: number;   // paying >50% income on housing
    };
    rentToIncomeRatio: number;
    homeValueToIncomeRatio: number;
  };

  housingTrends: {
    homeValueGrowthRate: number; // 5-year trend
    rentGrowthRate: number;
    newConstructionRate: number;
    movingTurnoverRate: number; // % moved in last year
  };
}

export interface EducationIntelligence {
  educationEcosystemScore: number; // 0-100
  
  educationalAttainment: {
    lessThanHighSchool: number;
    highSchoolGraduate: number;
    someCollege: number;
    associateDegree: number;
    bachelorsDegree: number;
    graduateDegree: number;
    medianEducationLevel: number;
  };

  schoolAgePopulation: {
    ages3to4: number; // preschool age
    ages5to9: number; // elementary
    ages10to14: number; // middle school
    ages15to17: number; // high school
    ages18to24: number; // college age
    schoolEnrollment: {
      preschool: number;
      elementary: number;
      highSchool: number;
      college: number;
    };
  };

  educationInvestment: {
    familiesWithSchoolAgeChildren: number;
    educationExpenditures: number; // household spending on education
    privateSchoolEnrollment: number; // percentage
    homeschoolRate: number;
  };

  intellectualEnvironment: {
    publicLibraryUsage: number;
    internetSubscriptions: number;
    computerOwnership: number;
    educationalServices: number; // tutoring, test prep businesses
  };
}

export interface MobilityIntelligence {
  populationStabilityScore: number; // 0-100
  
  migrationPatterns: {
    sameHouse1YearAgo: number; // stability indicator
    movedWithinCounty: number;
    movedFromOtherCounty: number;
    movedFromOtherState: number;
    movedFromAbroad: number;
    
    inMigrationRate: number; // people moving in
    outMigrationRate: number; // people moving out
    netMigrationRate: number; // net change
  };

  residentialStability: {
    averageResidenceLength: number;
    homeownershipRate: number;
    rentalTurnover: number;
    neighborhoodTenure: {
      under2years: number;
      years2to5: number;
      years6to10: number;
      years11to20: number;
      over20years: number;
    };
  };

  attractionFactors: {
    jobRelatedMoves: number;
    familyRelatedMoves: number;
    retirementMoves: number;
    housingRelatedMoves: number;
    climateRelatedMoves: number;
  };

  originDestinationAnalysis: {
    topOriginStates: string[];
    topDestinationStates: string[];
    internationalMigration: number;
    domesticMigration: number;
  };
}

export interface CensusGeographicIdentifier {
  state: string;
  county: string;
  tract: string;
  blockGroup?: string;
  block?: string;
}

export interface CensusDataRequest {
  variables: string[];
  geography: {
    level: 'block' | 'blockGroup' | 'tract' | 'county' | 'state';
    codes: CensusGeographicIdentifier;
  };
  year: number;
  dataset: 'acs5' | 'acs1' | 'dec' | 'popest';
}