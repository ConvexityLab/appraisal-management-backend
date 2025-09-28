/**
 * Comprehensive Geospatial Risk Assessment Types
 * Supporting TigerWeb, ESRI, FEMA, NOAA/EPA data sources
 */

// ===============================
// Core Geospatial Types
// ===============================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeospatialPolygon {
  coordinates: Coordinates[];
  type: 'Polygon' | 'MultiPolygon';
}

// ===============================
// FEMA Flood Risk Assessment
// ===============================

export interface FloodRiskData {
  // FEMA Flood Zone Classifications
  femaFloodZone: FloodZone | null;
  baseFloodElevation?: number; // BFE in feet
  floodInsuranceRequired: boolean;
  
  // Risk Assessment
  floodRiskScore: number; // 1-10 scale
  annualFloodProbability: number; // Percentage
  
  // Historical Data
  historicalFloodEvents: FloodEvent[];
  lastMajorFlood?: Date;
  
  // FIRM Data
  firmPanelNumber?: string;
  firmEffectiveDate?: Date;
  
  // Additional Risk Factors
  coastalRisk: boolean;
  leveeProtection: boolean;
  damProximity?: DamRisk;
}

export type FloodZone = 
  | 'A'    // 1% annual chance flood hazard
  | 'AE'   // 1% annual chance flood hazard with BFE
  | 'AH'   // 1% annual chance shallow flooding
  | 'AO'   // 1% annual chance sheet flow flooding
  | 'AR'   // 1% annual chance flooding in areas with levee
  | 'VE'   // 1% annual chance coastal flooding
  | 'X'    // Moderate to low risk
  | 'D';   // Undetermined risk

export interface FloodEvent {
  date: Date;
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
  waterLevel: number; // feet above normal
  femaDeclaration?: string;
  damageEstimate?: number;
}

export interface DamRisk {
  distanceMiles: number;
  damName: string;
  hazardClassification: 'low' | 'significant' | 'high';
  lastInspection?: Date;
}

// ===============================
// Historical & Cultural Data
// ===============================

export interface HistoricalDesignations {
  // National Register of Historic Places
  onNationalRegister: boolean;
  nrhpId?: string;
  listingDate?: Date;
  
  // Historic Districts
  historicDistrict?: {
    name: string;
    established: Date;
    significance: string;
    restrictions: string[];
  };
  
  // Landmark Status
  landmarkStatus: LandmarkLevel | null;
  landmarkName?: string;
  
  // Archaeological Sites
  archaeologicalSites: ArchaeologicalSite[];
  
  // Building Restrictions
  restrictions: HistoricalRestriction[];
}

export type LandmarkLevel = 'national' | 'state' | 'local';

export interface ArchaeologicalSite {
  siteName: string;
  significance: string;
  timeperiod: string;
  restrictions: string[];
}

export interface HistoricalRestriction {
  type: 'architectural' | 'demolition' | 'alteration' | 'archaeological';
  description: string;
  authority: string;
  permitRequired: boolean;
}

// ===============================
// Tribal Lands & Jurisdictions
// ===============================

export interface TribalLandData {
  onTribalLand: boolean;
  
  // Tribal Information
  tribeName?: string;
  tribalNation?: string;
  reservationName?: string;
  
  // Jurisdiction Details
  jurisdictionType: TribalJurisdiction;
  federalRecognition: boolean;
  
  // Legal Considerations
  specialConsiderations: string[];
  permitsRequired: string[];
  tribalLaws: string[];
  
  // Contact Information
  tribalOffice?: {
    name: string;
    phone?: string;
    address?: string;
  };
}

export type TribalJurisdiction = 
  | 'federal'           // Federal jurisdiction
  | 'tribal'            // Tribal jurisdiction
  | 'state'             // State jurisdiction
  | 'concurrent'        // Mixed jurisdiction
  | 'trust_land'        // Trust land
  | 'fee_simple';       // Fee simple on reservation

// ===============================
// Environmental & Climate Risk
// ===============================

export interface EnvironmentalRisk {
  // EPA Superfund Sites
  superfundSites: SuperfundSite[];
  
  // Hazardous Materials
  hazmatFacilities: HazmatFacility[];
  
  // Air Quality
  airQuality: AirQualityData;
  
  // Water Quality
  waterQuality: WaterQualityData;
  
  // Soil Contamination
  soilContamination: SoilContaminationData;
  
  // Noise Pollution
  noiseLevels: NoiseLevelData;
}

export interface SuperfundSite {
  siteName: string;
  epaId: string;
  status: 'proposed' | 'final' | 'deleted' | 'construction_complete';
  distanceMiles: number;
  contaminants: string[];
  cleanupStatus: string;
}

export interface HazmatFacility {
  facilityName: string;
  facilityType: string;
  distanceMiles: number;
  chemicals: string[];
  riskLevel: 'low' | 'moderate' | 'high';
}

export interface AirQualityData {
  aqiScore: number; // Air Quality Index
  primaryPollutant: string;
  unhealthyDays: number; // per year
  nearbyEmissionSources: string[];
}

export interface WaterQualityData {
  drinkingWaterQuality: 'excellent' | 'good' | 'fair' | 'poor';
  contaminantViolations: string[];
  waterSource: string;
  wellWaterRisk?: boolean;
}

export interface SoilContaminationData {
  contaminationRisk: 'low' | 'moderate' | 'high';
  knownContaminants: string[];
  testingRecommended: boolean;
  industrialHistory: boolean;
}

export interface NoiseLevelData {
  averageDecibels: number;
  noiseSources: string[];
  airportProximity?: {
    distanceMiles: number;
    airportName: string;
    flightPaths: boolean;
  };
  railroadProximity?: {
    distanceMiles: number;
    trafficLevel: 'light' | 'moderate' | 'heavy';
  };
}

// ===============================
// Natural Disaster Risk
// ===============================

export interface DisasterRiskData {
  // FEMA Disaster Declarations
  femaDisasterHistory: FemaDisaster[];
  
  // Specific Disaster Types
  hurricaneRisk: HurricaneRisk;
  earthquakeRisk: EarthquakeRisk;
  wildfireRisk: WildfireRisk;
  tornadoRisk: TornadoRisk;
  winterStormRisk: WinterStormRisk;
  
  // Overall Risk Score
  overallDisasterRisk: number; // 1-10 scale
}

export interface FemaDisaster {
  disasterNumber: string;
  declarationType: 'major_disaster' | 'emergency' | 'fire_management';
  declarationDate: Date;
  disasterType: string;
  affectedAreas: string[];
  federalFunding: number;
}

export interface HurricaneRisk {
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  historicalHurricanes: HurricaneEvent[];
  evacuationZone?: string;
  stormSurgeRisk: number; // feet
  windSpeedRisk: number; // mph
}

export interface HurricaneEvent {
  name: string;
  year: number;
  category: number;
  maxWindSpeed: number;
  stormSurge: number;
  damages: number;
}

export interface EarthquakeRisk {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'very_high';
  peakGroundAcceleration: number; // %g
  nearestFaultDistance: number; // miles
  faultName?: string;
  historicalEarthquakes: EarthquakeEvent[];
  liquefactionRisk: boolean;
}

export interface EarthquakeEvent {
  date: Date;
  magnitude: number;
  depth: number;
  epicenterDistance: number;
  intensity: string; // Modified Mercalli scale
}

export interface WildfireRisk {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  wildlandUrbanInterface: boolean; // WUI zone
  vegetationRisk: 'low' | 'moderate' | 'high';
  historicalFires: WildfireEvent[];
  fireweatherRisk: number; // days per year
  evacuationDifficulty: 'easy' | 'moderate' | 'difficult';
}

export interface WildfireEvent {
  fireName: string;
  year: number;
  acresBurned: number;
  containmentDays: number;
  proximityMiles: number;
  cause: string;
}

export interface TornadoRisk {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  tornadoAlley: boolean;
  historicalTornadoes: TornadoEvent[];
  averageTornadoesPerYear: number;
  strongestHistoricalRating: string; // EF Scale
}

export interface TornadoEvent {
  date: Date;
  efRating: string; // EF0-EF5
  pathLengthMiles: number;
  maxWindSpeed: number;
  proximityMiles: number;
}

export interface WinterStormRisk {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  averageSnowfallInches: number;
  iceStormRisk: boolean;
  blizzardRisk: boolean;
  historicalStorms: WinterStormEvent[];
}

export interface WinterStormEvent {
  date: Date;
  stormType: 'snow' | 'ice' | 'blizzard' | 'mixed';
  snowfallInches?: number;
  iceAccumulation?: number;
  windSpeed?: number;
  powerOutageDays?: number;
}

// ===============================
// Census & Demographic Data
// ===============================

export interface CensusData {
  // Geographic Identifiers
  fipsCode: string;
  censusTract: string;
  censusBlock?: string;
  congressionalDistrict: string;
  
  // Administrative Boundaries
  county: string;
  municipality?: string;
  schoolDistrict?: string;
  
  // Demographic Information
  population: number;
  householdCount: number;
  medianIncome: number;
  povertyRate: number;
  
  // Housing Data
  medianHomeValue: number;
  ownerOccupancyRate: number;
  rentVsOwnRatio: number;
  housingUnitsCount: number;
}

// ===============================
// Comprehensive Property Risk Assessment
// ===============================

export interface PropertyRiskAssessment {
  // Property Identification
  propertyId?: string;
  coordinates: Coordinates;
  
  // Comprehensive Risk Categories
  floodRisk: FloodRiskData;
  disasterRisk: DisasterRiskData;
  environmentalRisk: EnvironmentalRisk;
  historicalDesignations: HistoricalDesignations;
  tribalLandData: TribalLandData;
  censusData: CensusData;
  
  // Overall Assessment
  overallRiskScore: number; // 1-10 composite score
  riskCategories: RiskCategory[];
  
  // Insurance & Compliance
  insuranceRequirements: InsuranceRequirement[];
  regulatoryCompliance: RegulatoryRequirement[];
  
  // Data Quality & Source Information
  dataQuality: DataQualityMetrics;
  lastAssessed: Date;
  expirationDate: Date;
  dataSources: string[];
}

export interface RiskCategory {
  category: 'flood' | 'disaster' | 'environmental' | 'historical' | 'tribal';
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  score: number;
  factors: string[];
  recommendations: string[];
}

export interface InsuranceRequirement {
  type: 'flood' | 'earthquake' | 'windstorm' | 'environmental';
  required: boolean;
  provider?: string;
  estimatedCost?: number;
  deductible?: number;
  notes: string[];
}

export interface RegulatoryRequirement {
  authority: string;
  requirement: string;
  permitRequired: boolean;
  estimatedCost?: number;
  processingTime?: string;
  contacts: string[];
}

export interface DataQualityMetrics {
  completeness: number; // 0-100%
  accuracy: number; // 0-100%
  recency: number; // days since last update
  reliability: 'low' | 'moderate' | 'high';
  missingDataSources: string[];
}

// ===============================
// API Response Types
// ===============================

export interface GeospatialApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    processingTime: number;
    dataSource: string;
    cacheHit: boolean;
    expiresAt: Date;
  };
}

export interface BatchRiskAssessmentRequest {
  properties: Array<{
    propertyId?: string;
    coordinates: Coordinates;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  }>;
  includeDetails?: boolean;
  cacheResults?: boolean;
}

export interface BatchRiskAssessmentResponse {
  success: boolean;
  results: PropertyRiskAssessment[];
  errors: Array<{
    propertyId?: string;
    coordinates: Coordinates;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}